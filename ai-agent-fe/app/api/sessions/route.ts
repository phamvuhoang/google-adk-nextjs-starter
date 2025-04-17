import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore'; // Use Admin SDK types
import { Message } from '@/lib/types/firestore'; // Only import used type
import { AdkEvent } from '@/lib/types/sessions';

/**
 * Helper function to add a message using Admin SDK.
 */
async function addAdminMessageToSession(
    sessionId: string,
    sender: 'user' | 'assistant',
    text: string,
    metadata?: Record<string, unknown>
): Promise<string> {
    const db = getAdminDb(); // Get Admin DB instance
    const messagesRef = db.collection("sessions").doc(sessionId).collection("messages");
    const sessionRef = db.collection("sessions").doc(sessionId);
    const messageData = {
        sender,
        text,
        createdAt: FieldValue.serverTimestamp(),
        ...(metadata && { metadata }),
    };
    const docRef = await messagesRef.add(messageData);
    await sessionRef.update({ updatedAt: FieldValue.serverTimestamp() });
    console.log(`ADMIN: Added ${sender} message to session ${sessionId}, ID: ${docRef.id}`);
    return docRef.id;
}

// GET: Get all sessions for the user
export async function GET(request: Request) {
    let auth;
    let db;
    try {
        // Use getters which ensure initialization
        auth = getAdminAuth();
        db = getAdminDb(); 
    } catch (initError) {
        console.error("Failed to initialize Firebase Admin services:", initError);
        return NextResponse.json({ error: 'Failed to initialize admin services' }, { status: 500 });
    }

    // Authenticate User
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
        console.error('Error verifying auth token:', error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = decodedToken.uid;

    // Get all sessions for the user
    try {
        const sessionsColRef = db.collection('sessions');
        const snapshot = await sessionsColRef.where('ownerId', '==', userId)
            .orderBy('updatedAt', 'desc')
            .get();

        const sessions = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                sessionId: doc.id,
                title: data.title,
                createdAt: data.createdAt?.toDate?.() || null,
                updatedAt: data.updatedAt?.toDate?.() || null,
                status: data.status || 'active',
                ownerId: data.ownerId,
            };
        });

        return NextResponse.json(sessions);
    } catch (error) {
        console.error(`Error fetching sessions for user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal server error fetching sessions';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// POST: Create Session
export async function POST(request: Request) {
    let auth;
    let db;
    try {
        // Use getters which ensure initialization
        auth = getAdminAuth();
        db = getAdminDb(); 
    } catch (initError) {
        console.error("Failed to initialize Firebase Admin services:", initError);
        return NextResponse.json({ error: 'Failed to initialize admin services' }, { status: 500 });
    }

    // 1. Authenticate User
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
        console.error('Error verifying auth token:', error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = decodedToken.uid;

    // 2. Get Optional Request Body
    let requestBody = null;
    let initialMessage: string | null = null;
    let sessionTitle: string | undefined = undefined;
    try {
        requestBody = await request.json();
        initialMessage = requestBody?.message;
        sessionTitle = requestBody?.title;
    } catch (parseError) { // Give error a name to use it
        // Log only if it's not an empty body error
        if (!(parseError instanceof SyntaxError && (parseError as SyntaxError).message.includes('Unexpected end of JSON input'))) {
             console.warn("Error parsing request body for session creation:", parseError);
        } else {
             console.log("No request body found for session creation, proceeding without initial message/title.");
        }
    }

    // 3. Create New Session Document in Firestore
    try {
        const sessionsColRef = db.collection('sessions');
        const now = FieldValue.serverTimestamp();

        // Define type for data to be added
        const newSessionData = {
            ownerId: userId,
            title: sessionTitle || `Session started ${new Date().toLocaleString()}`,
            createdAt: now,
            updatedAt: now,
            status: 'active' as const,
        };
        
        const docRef = await sessionsColRef.add(newSessionData);
        const newSessionId = docRef.id;

        console.log(`Created new session ${newSessionId} for user ${userId}`);

        let assistantResponsePayload: Partial<Message> | null = null;

        // 4. Handle Initial Message (if provided)
        if (initialMessage) {
            await addAdminMessageToSession(newSessionId, 'user', initialMessage);

            const ADK_AGENT_URL = process.env.ADK_AGENT_URL || 'http://localhost:8000';
            const agentRequestBody = {
                 user_id: userId,
                 session_id: newSessionId,
                 new_message: { role: 'user', text: initialMessage },
             };
            
             try {
                 const agentResponse = await fetch(ADK_AGENT_URL + '/run', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify(agentRequestBody),
                 });

                 if (agentResponse.ok) {
                     const agentResult = await agentResponse.json();
                     let assistantMessageText = 'Agent acknowledged.';
                     if (Array.isArray(agentResult?.events)) {
                          const finalEvent = agentResult.events.find((e: AdkEvent) => e.event_type === 'FINAL_RESPONSE');
                          if (finalEvent?.content?.parts?.[0]?.text) {
                              assistantMessageText = finalEvent.content.parts[0].text;
                          }
                     } else if (agentResult?.final_response?.text) {
                          assistantMessageText = agentResult.final_response.text;
                     }
                     
                     const assistantMessageId = await addAdminMessageToSession(newSessionId, 'assistant', assistantMessageText);
                     assistantResponsePayload = {
                         messageId: assistantMessageId,
                         sender: 'assistant',
                         text: assistantMessageText,
                         role: 'assistant',
                     };
                 } else {
                      console.error(`ADK Agent Error on initial message: ${agentResponse.statusText} (${agentResponse.status})`);
                 }
             } catch (fetchError) {
                  console.error(`Error fetching ADK agent for initial message:`, fetchError);
             }
        }

        // 5. Return New Session Info
        // Use the structure matching CreateSessionResponse defined elsewhere (or ensure consistency)
        const responsePayload = {
            sessionId: newSessionId,
            ownerId: userId,
            title: newSessionData.title,
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString(),
            status: newSessionData.status,
            initialAssistantMessage: assistantResponsePayload, 
        };

        return NextResponse.json(responsePayload, { status: 201 });

    } catch (error) {
        console.error(`Error creating session for user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal server error creating session';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 