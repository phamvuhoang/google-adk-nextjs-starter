import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/admin';
import { v4 as uuid } from 'uuid';
import { 
  AdkSessionPayload,
  AdkRequestPayloadWithStreaming,
  AdkEvent 
} from '@/lib/types/adk';
import { AssistantApiResponse } from '@/lib/types/ui'; 
import { GoogleAuth } from 'google-auth-library';
// Remove ReadableStream import if not piping directly
// import { ReadableStream } from 'stream/web'; 

// Get the environment-specific configuration
const useCloudADKEnv = process.env.USE_CLOUD_ADK;
const useCloudADK = useCloudADKEnv === "true" || useCloudADKEnv === "yes" || useCloudADKEnv === "1";
const bypassAuth = useCloudADK ? false : (process.env.NO_ADK_AUTH === "true" || process.env.NO_ADK_AUTH === "yes" || process.env.NO_ADK_AUTH === "1");
const debugMode = process.env.DEBUG_ADK_INTEGRATION === "true";

// Get the appropriate ADK URL based on environment
const adkURL = useCloudADK 
  ? process.env.CLOUD_ADK_URL || ''
  : process.env.LOCAL_ADK_URL || '';

// API endpoints
const adkEndpoint = process.env.ADK_PRIMARY_ENDPOINT || '/run';
const fullAdkURL = `${adkURL}${adkEndpoint}`;

// Debug logging for configuration
if (debugMode) {
  console.log('ADK Configuration:', {
    useCloudADK,
    adkURL,
    adkEndpoint,
    fullAdkURL,
    bypassAuth
  });
}

/**
 * Helper function to get an ID token for Cloud Run authentication
 */
async function getCloudRunIdToken() {
  try {
    if (!useCloudADK) {
      // For local development, still use Firebase Admin token
      return getFirebaseAdminToken();
    }
    
    // For Cloud Run, we need an ID token with the correct audience
    const cloudRunAudience = adkURL; // The audience must be the Cloud Run service URL
    
    if (debugMode) {
      console.log(`Getting ID token for Cloud Run with audience: ${cloudRunAudience}`);
    }

    // Check if a service account key is available
    // This should be set as an environment variable containing the service account JSON
    let auth;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        auth = new GoogleAuth({
          credentials,
          projectId: process.env.GOOGLE_CLOUD_PROJECT || 'mindlab-3ce49',
        });
        
        if (debugMode) {
          console.log('Using provided service account credentials for Google Auth');
        }
      } catch (error) {
        console.error('Error parsing service account JSON:', error);
        // Fall back to default credentials if parsing fails
        auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
      }
    } else {
      if (debugMode) {
        console.log('No explicit service account credentials found, using Application Default Credentials');
      }
      
      // Use Application Default Credentials
      auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    }
    
    // Get ID token client for the specific audience (Cloud Run URL)
    const client = await auth.getIdTokenClient(cloudRunAudience);
    const idToken = await client.idTokenProvider.fetchIdToken(cloudRunAudience);
    
    if (debugMode) {
      const tokenPrefix = idToken.substring(0, 10) + '...';
      console.log(`Successfully obtained ID token: ${tokenPrefix}`);
    }
    
    return idToken;
  } catch (error) {
    console.error('Error getting ID token for Cloud Run:', error);
    // Fall back to Firebase Admin token if ID token fetch fails
    return getFirebaseAdminToken();
  }
}

/**
 * Helper function to get token from Firebase Admin SDK (fallback)
 */
async function getFirebaseAdminToken() {
  try {
    const adminApp = getAdminApp();
    if (adminApp && adminApp.options.credential) {
      // Get token from Firebase Admin SDK
      const token = await adminApp.options.credential.getAccessToken();
      
      if (debugMode) {
        console.log('Falling back to Firebase Admin SDK access token');
      }
      
      return token.access_token;
    }
    console.error('Firebase Admin is not properly initialized');
    return null;
  } catch (error) {
    console.error('Error getting Firebase Admin token:', error);
    return null;
  }
}

/**
 * Create or ensure a session exists in the ADK service
 */
async function ensureSession(
  appName: string, 
  userId: string, 
  sessionId: string, 
  authHeaders: HeadersInit
): Promise<boolean> {
  try {
    const sessionUrl = `${adkURL}/apps/${appName}/users/${userId}/sessions/${sessionId}`;
    const sessionPayload: AdkSessionPayload = { state: {} };
    
    if (debugMode) {
      console.log(`Creating/ensuring session at: ${sessionUrl}`);
      console.log('Session creation headers:', JSON.stringify(authHeaders));
    }
    
    const response = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(sessionPayload)
    });
    
    if (debugMode) {
      console.log(`Session creation response status: ${response.status}`);
      try {
        const responseText = await response.text();
        console.log(`Session creation response: ${responseText}`);
        // Re-create response since we already consumed the body
        return response.status === 200 || response.status === 400;
      } catch (error) {
        console.error('Error reading session response:', error);
      }
    }
    
    // 200 = success, 400 = session already exists (both are okay)
    return response.ok || response.status === 400;
  } catch (error) {
    console.error('Error creating session:', error);
    return false;
  }
}

// Helper to extract text and next_actions from ADK JSON content string
function parseAdkJsonContentString(jsonString: string): { text: string | null, next_actions: string[] } {
    try {
        const parsed = JSON.parse(jsonString);
        return {
            text: parsed.content || null,
            next_actions: parsed.next_actions || []
        };
    } catch (e) {
        console.warn("Could not parse ADK JSON content string:", jsonString, e);
        if (!jsonString.trim().startsWith('{')) {
             return { text: jsonString, next_actions: [] };
        }
        return { text: null, next_actions: [] };
    }
}

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming request
    const requestData = await request.json();
    
    // Extract data - support both formats:
    const sessionId = requestData.sessionId;
    const message = requestData.message || requestData.userMessage;
    
    // Log debugging information
    if (debugMode) {
      console.log('Received request for streaming:', {
        sessionId,
        message
      });
    }
    
    // Create a session ID if not provided
    const finalSessionId = sessionId || uuid();
    const userId = `user-${finalSessionId.substring(0, 8)}`;
    const appName = "ai-agent";
    
    // Ensure we have a message
    if (!message || typeof message !== 'string' || !message.trim()) {
      if (debugMode) {
        console.log('Missing or empty message content');
      }
      return NextResponse.json(
        { error: 'Please provide a non-empty message' },
        { status: 400 }
      );
    }
    
    // Prepare the request headers to the ADK service
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream' // Important: Accept SSE
    };
    
    // Add authentication (same logic as before)
    if (useCloudADK) {
      const idToken = await getCloudRunIdToken();
      if (!idToken) {
        if (debugMode) console.error('Failed to obtain auth token for Cloud ADK');
        return NextResponse.json({ error: 'Failed to obtain auth token for Cloud ADK' }, { status: 500 });
      }
      headers['Authorization'] = `Bearer ${idToken}`;
      if (debugMode) {
        const tokenPrefix = idToken.substring(0, 10) + '...';
        console.log(`Added auth token for Cloud ADK: Bearer ${tokenPrefix}`);
      }
    } else if (!bypassAuth) {
      const token = await getFirebaseAdminToken();
      if (!token) {
        return NextResponse.json({ error: 'Failed to obtain auth token' }, { status: 500 });
      }
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // First, ensure the session exists
    const sessionCreated = await ensureSession(appName, userId, finalSessionId, headers);
    if (!sessionCreated) {
      return NextResponse.json({ error: 'Failed to create or verify session' }, { status: 500 });
    }
    
    // Set up the request payload for ADK using the imported type
    const adkPayload: AdkRequestPayloadWithStreaming = {
      app_name: appName,
      user_id: userId,
      session_id: finalSessionId,
      new_message: {
        role: "user",
        parts: [{ text: message.trim() }]
      },
      streaming: true // Request SSE streaming
    };

    // Target the /run_sse endpoint explicitly
    const sseUrl = `${adkURL}/run_sse`; 
    
    if (debugMode) {
      console.log(`Sending SSE request to ADK at: ${sseUrl}`);
      console.log('Using headers:', headers);
      console.log('Using payload:', JSON.stringify(adkPayload));
    }
    
    // Make the streaming request to the ADK service
    const adkResponse = await fetch(sseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(adkPayload),
    });
    
    // Check if the initial response is okay (status code 200)
    if (!adkResponse.ok) {
      const errorText = await adkResponse.text();
      const errorDetails = `ADK SSE request failed (${adkResponse.status}): ${errorText}`;
      console.error('ADK service error:', {
        status: adkResponse.status,
        statusText: adkResponse.statusText,
        body: errorText,
        headers: Object.fromEntries(adkResponse.headers.entries()),
        url: sseUrl
      });
      console.error(errorDetails);
      return NextResponse.json(
        { error: `ADK SSE request failed: ${errorText}` },
        { status: adkResponse.status }
      );
    }

    if (!adkResponse.body) {
      return NextResponse.json({ error: 'ADK service did not return a stream body' }, { status: 500 });
    }

    // --- Process the SSE Stream Internally --- 
    let finalApiResponse: AssistantApiResponse | null = null;
    let processingError: string | null = null;

    const reader = adkResponse.body!.getReader(); 
    const decoder = new TextDecoder("utf-8");
    let partial = "";

    try {
      while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          partial += decoder.decode(value, { stream: true });
          let boundary;

          while ((boundary = partial.indexOf("\n\n")) !== -1) {
              const messageChunk = partial.slice(0, boundary);
              partial = partial.slice(boundary + 2);

              if (messageChunk.startsWith("data: ")) {
                  try {
                      const jsonData = messageChunk.slice(6);
                      const event: AdkEvent = JSON.parse(jsonData); 

                      // Check if this event contains the definitive final JSON response
                      if (event.content?.parts?.[0]?.text) {
                          const rawText = event.content.parts[0].text;
                          const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
                          
                          if (jsonMatch?.[1]) {
                              // Found the final JSON block, parse it and consider processing done
                              const parsedContent = parseAdkJsonContentString(jsonMatch[1]);
                              if (parsedContent.text !== null) { // Ensure we got valid content
                                  finalApiResponse = {
                                      messageId: event.id || `assistant-${Date.now()}`,
                                      text: parsedContent.text,
                                      next_actions: parsedContent.next_actions,
                                      sessionId: finalSessionId,
                                      role: 'assistant', 
                                  };
                              } else {
                                  console.warn("Parsed null text from final JSON block in event:", event.id);
                              }
                          } else {
                            // Optional: Handle potential non-JSON text from model/AICofounder 
                            // Currently, we prioritize the explicit JSON block.
                          }
                      }
                      // Ignore events without content or not matching the final structure

                  } catch (e) {
                      console.error("Failed to parse SSE event in API route:", e, messageChunk);
                      processingError = `Failed to parse agent event: ${e instanceof Error ? e.message : String(e)}`;
                  }
              }
          }
      }
      if (debugMode) console.log('Finished processing ADK stream internally.');
    } catch (streamError) {
        console.error('Error reading ADK stream in API route:', streamError);
        processingError = `Failed to read agent response stream: ${streamError instanceof Error ? streamError.message : String(streamError)}`;
    } finally {
        reader.releaseLock(); 
    }
    // --- End Stream Processing --- 

    // Check if we successfully extracted the final response
    if (finalApiResponse) {
        if (debugMode) {
            console.log('Sending final parsed response to frontend:', finalApiResponse);
        }
        return NextResponse.json(finalApiResponse);
    } else {
        // If no valid finalApiResponse was built, return an error
        // Use the processing error if available, otherwise a generic message
        const errorMsg = processingError || "Agent did not return a recognizable final response.";
        console.error("Could not extract final response from ADK stream. Error:", errorMsg);
        // Try to return a 500 error, but might need adjustment based on expected frontend handling
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    
  } catch (error) {
    const errorMessage = `Error in ADK API route: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
