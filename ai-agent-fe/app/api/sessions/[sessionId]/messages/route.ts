import { NextResponse } from 'next/server';
import { getAdminAuth, admin } from '@/lib/firebase/admin';
import { addMessageToSession, ensureSessionExists } from '@/lib/firebase/firestore.server';
import { Message } from '@/lib/types/firestore';
import { AdkResponse } from '@/lib/types/api';

// Configure the ADK Agent URL - now handled via the proxy
const PROXY_URL = process.env.NEXT_PUBLIC_DEPLOY_URL || 'http://localhost:3000';

// Add a graceful fallback for when the ADK agent is unavailable
const handleAgentUnavailable = (sessionId: string, userMessageText: string) => {
    return {
        text: "I'm sorry, but I'm temporarily unable to process your request. The AI agent service is currently unavailable. Please try again later.",
        metadata: {
            error: "agent_unavailable",
            userMessage: userMessageText
        }
    };
};

// Helper function to extract the response text from various ADK response formats
const extractResponseText = (result: AdkResponse): { text: string, next_actions?: string[] } => {
    // Default message if we can't extract anything
    let text = 'Sorry, I could not process your request.';
    let next_actions: string[] | undefined = undefined;
    
    if (!result) return { text };

    console.log(`ADK response received: \n\n\n${JSON.stringify(result)}\n\n\n`);
    
    // First, try to extract next_actions from various locations
    if (typeof result.message === 'object' && result.message !== null && 
        'content' in result.message && 
        typeof result.message.content === 'object' && result.message.content !== null &&
        'next_actions' in result.message.content && 
        Array.isArray(result.message.content.next_actions)) {
        next_actions = result.message.content.next_actions;
    } else if (result.next_actions && Array.isArray(result.next_actions)) {
        next_actions = result.next_actions;
    }
    
    // Check various response formats that the ADK might return
    if (typeof result.message === 'object' && result.message !== null && 
        'content' in result.message && 
        typeof result.message.content === 'object' && result.message.content !== null &&
        'parts' in result.message.content && 
        Array.isArray(result.message.content.parts) &&
        result.message.content.parts[0]?.text) {
        // New structure from our updated ADK API
        text = result.message.content.parts[0].text;
    } else if (Array.isArray(result.events)) {
        const finalEvent = result.events.find(e => e.event_type === 'FINAL_RESPONSE');
        if (finalEvent?.content?.parts?.[0]?.text) {
            text = finalEvent.content.parts[0].text;
        } else {
            console.warn('Could not find final assistant text in events array:', result.events);
        }
    } else if (result.final_response?.text) {
        text = result.final_response.text;
    } else if (typeof result.response === 'string') {
        // Simple string response format
        text = result.response;
    } else if (result.text) {
        // Direct text field
        text = result.text;
    } else if (result.content) {
        // Content field check
        text = typeof result.content === 'string'
            ? result.content
            : JSON.stringify(result.content);
    } else if (result.message) {
        // Message field 
        if (typeof result.message === 'string') {
            text = result.message;
        } else {
            // Try to extract from our custom structure
            const messageObj = result.message;
            if (typeof messageObj === 'object' && messageObj !== null) {
                if ('text' in messageObj && typeof messageObj.text === 'string') {
                    text = messageObj.text;
                } else {
                    text = JSON.stringify(messageObj);
                }
            } else {
                text = JSON.stringify(result.message);
            }
        }
    } else {
        console.warn('Unexpected response structure:', result);
    }
    
    // Try to extract JSON structure from text if it's enclosed in markdown code blocks
    // This handles responses from our AI agent that are JSON inside markdown
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            const parsedJson = JSON.parse(jsonMatch[1]);
            if (parsedJson.content) {
                text = parsedJson.content;
            }
            if (parsedJson.next_actions && Array.isArray(parsedJson.next_actions)) {
                next_actions = parsedJson.next_actions;
            }
        } catch (e) {
            console.warn('Failed to parse JSON in markdown block:', e);
        }
    }
    
    return { text, next_actions };
};

export async function POST(
    request: Request,
    context: { params: { sessionId: string } }
) {
    // Use Promise.resolve to await params as required by Next.js
    const { sessionId } = await Promise.resolve(context.params);

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }
    
    // 1. Authenticate User
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];

    let decodedToken;
    try {
        const auth = getAdminAuth();
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
        // Check if the error is due to failed initialization in admin.ts
        if (admin.apps.length === 0) {
             console.error("Firebase Admin SDK seems not to be initialized. Check admin.ts and credentials.");
              return NextResponse.json({ error: 'Admin SDK initialization failed' }, { status: 500 });
        }
        console.error('Error verifying auth token:', error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = decodedToken.uid;

    // Log user access to this session
    console.log(`User ${userId} accessing session ${sessionId}`);

    // 2. Get User Message from Request Body
    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        console.error("Failed to parse request JSON:", error);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const userMessageText = requestBody.message;
    if (!userMessageText || typeof userMessageText !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid \'message\' field in body' }, { status: 400 });
    }

    try {
        // Ensure the session document exists in Firestore
        await ensureSessionExists(sessionId, userId);
        
        // 3. Save User Message to Firestore
        console.log(`Adding user message to session ${sessionId}`);
        const userMessageId = await addMessageToSession(sessionId, 'user', userMessageText);
        console.log(`Added user message to session ${sessionId}, message ID: ${userMessageId}`);

        // 4. Call Internal ADK Proxy
        const adkProxyUrl = `${PROXY_URL}/api/adk`;
        console.log(`Calling ADK Agent at ${adkProxyUrl} for session ${sessionId} with message: "${userMessageText}"`);

        let assistantMessageText: string;
        let extractedNextActions: string[] | undefined;
        try {
            const proxyResponse = await fetch(adkProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}` // Pass the token for auth
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    userMessage: userMessageText
                }),
                signal: AbortSignal.timeout(60000), // 60 second timeout
            });

            if (!proxyResponse.ok) {
                const errorText = await proxyResponse.text();
                console.error(`ADK proxy request failed (${proxyResponse.status}): ${errorText}`);
                throw new Error(`ADK proxy request failed: ${errorText}`);
            }
            
            const adkResult = await proxyResponse.json();
            console.log('ADK response received:', JSON.stringify(adkResult).substring(0, 200) + '...');
            
            const { text: extractedText, next_actions } = extractResponseText(adkResult);
            assistantMessageText = extractedText;
            extractedNextActions = next_actions;
        } catch (error: unknown) {
            console.error(`Error connecting to ADK agent: ${error instanceof Error ? error.message : String(error)}`);
            // Use fallback response
            const fallbackResponse = handleAgentUnavailable(sessionId, userMessageText);
            assistantMessageText = fallbackResponse.text;
            extractedNextActions = undefined;
        }

        // 5. Save Assistant Message to Firestore
        console.log(`Adding assistant message to session ${sessionId}`);
        const assistantMessageId = await addMessageToSession(
            sessionId, 
            'assistant', 
            assistantMessageText,
            extractedNextActions
        );
        console.log(`Added assistant message to session ${sessionId}, message ID: ${assistantMessageId}`);

        // 6. Return Assistant Message to Frontend
        const assistantMessage: Partial<Message> = {
            messageId: assistantMessageId,
            sender: 'assistant',
            text: assistantMessageText,
            role: 'assistant',
            next_actions: extractedNextActions,
        };

        return NextResponse.json(assistantMessage, { status: 200 });

    } catch (error) {
        console.error(`Error processing message for session ${sessionId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}