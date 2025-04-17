import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/admin';
import { v4 as uuid } from 'uuid';
import { 
  AdkMessage, 
  AdkRequestPayload,
  AdkSessionPayload,
  AdkApiResponse,
  AdkEvent
} from '@/lib/types/adk';
import { GoogleAuth } from 'google-auth-library';

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
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
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
 * Parse the agent response to extract structured content
 */
function parseAgentResponse(responseData: string | AdkEvent[]): AdkMessage {
  try {
    // Check if the response is already parsed as JSON
    if (typeof responseData !== 'string') {
      // The response is already a JSON object/array
      
      // ADK returns an array of events; find the model response
      if (Array.isArray(responseData)) {
        // Find the first event with model content
        const modelEvent = responseData.find(
          event => event.content?.role === 'model' || event.author === 'AICofounder'
        );
        
        if (modelEvent) {
          const textContent = modelEvent.content?.parts?.[0]?.text;
          
          if (textContent) {
            // Try to extract structured JSON from markdown format
            const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/);
            
            if (jsonMatch && jsonMatch[1]) {
              try {
                // Parse the JSON inside the markdown block
                const parsed = JSON.parse(jsonMatch[1]);
                return {
                  content: {
                    parts: [
                      { 
                        text: parsed.content,
                        mime_type: 'text/plain'
                      }
                    ],
                    next_actions: parsed.next_actions || []
                  }
                };
              } catch (jsonError) {
                console.error('Error parsing JSON inside markdown block:', jsonError);
                // Fall back to using the full text
                return {
                  content: {
                    parts: [{ text: textContent, mime_type: 'text/plain' }]
                  }
                };
              }
            }
            
            // No JSON block found, use the text directly
            return {
              content: {
                parts: [{ text: textContent, mime_type: 'text/plain' }]
              }
            };
          }
        }
      }
      
      // Fallback for unexpected structure
      console.warn('Unexpected ADK response format:', typeof responseData);
      return {
        content: {
          parts: [{ 
            text: 'Received response in unexpected format from AI agent', 
            mime_type: 'text/plain' 
          }]
        }
      };
    }
    
    // Handle string response (old path for backward compatibility)
    // Look for a JSON object in the response string
    const jsonMatch = responseData.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch && jsonMatch[1]) {
      // Parse the JSON object
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        content: {
          parts: [
            { 
              text: parsed.content,
              mime_type: 'text/plain'
            }
          ],
          next_actions: parsed.next_actions || []
        }
      };
    }
    
    // If no JSON object is found, create a simple message
    return {
      content: {
        parts: [{ text: responseData, mime_type: 'text/plain' }]
      }
    };
  } catch (error) {
    console.error('Error parsing agent response:', error);
    return {
      content: {
        parts: [{ 
          text: 'Error processing the AI agent response', 
          mime_type: 'text/plain' 
        }]
      }
    };
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

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming request
    const requestData = await request.json();
    
    // Extract data - support both formats:
    // 1. { sessionId: string, message: string } - direct API call
    // 2. { sessionId: string, userMessage: string } - from messages/route.ts
    const sessionId = requestData.sessionId;
    const message = requestData.message || requestData.userMessage;
    
    // Log debugging information
    if (debugMode) {
      console.log('Received request:', {
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
    
    // Prepare the request to the ADK service
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Always add authentication if using Cloud ADK, regardless of bypassAuth setting
    if (useCloudADK) {
      // Get ID token specifically for Cloud Run authentication
      const idToken = await getCloudRunIdToken();
      if (!idToken) {
        if (debugMode) {
          console.error('Failed to obtain authentication token for Cloud ADK');
        }
        return NextResponse.json(
          { error: 'Failed to obtain authentication token for Cloud ADK' },
          { status: 500 }
        );
      }
      
      // For Cloud Run, format must be exactly: Bearer TOKEN (no extra spaces, case sensitive)
      headers['Authorization'] = `Bearer ${idToken}`;
      
      if (debugMode) {
        // Log just the first few characters of the token for debugging (avoid logging full tokens)
        const tokenPrefix = idToken.substring(0, 10) + '...';
        console.log(`Added authentication token for Cloud ADK request: Bearer ${tokenPrefix}`);
      }
    } else if (!bypassAuth) {
      // Only for local ADK that requires auth
      const token = await getFirebaseAdminToken();
      if (!token) {
        return NextResponse.json(
          { error: 'Failed to obtain authentication token' },
          { status: 500 }
        );
      }
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // First, ensure the session exists
    const sessionCreated = await ensureSession(appName, userId, finalSessionId, headers);
    if (!sessionCreated) {
      return NextResponse.json(
        { error: 'Failed to create or verify session' },
        { status: 500 }
      );
    }
    
    // Set up the request payload for ADK
    const payload: AdkRequestPayload = {
      app_name: appName,
      user_id: userId,
      session_id: finalSessionId,
      new_message: {
        role: "user",
        parts: [{ text: message.trim() }]
      }
    };
    
    if (debugMode) {
      console.log(`Sending request to ADK at: ${fullAdkURL}`);
      console.log('Using headers:', headers);
      console.log('Using payload:', JSON.stringify(payload));
    }
    
    // Make the request to the ADK service
    const response = await fetch(fullAdkURL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      const errorDetails = `ADK proxy request failed (${response.status}): ${errorText}`;
      console.error('ADK service error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        headers: Object.fromEntries(response.headers.entries()),
        url: fullAdkURL
      });
      
      console.error(errorDetails);
      
      return NextResponse.json(
        { error: `ADK proxy request failed: ${errorText}` },
        { status: response.status }
      );
    }
    
    // Parse the response from the ADK service as JSON, not text
    let responseData;
    const contentType = response.headers.get('content-type');
    
    // If the response is JSON, parse it directly
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      // Otherwise, get the raw text
      responseData = await response.text();
    }
    
    if (debugMode) {
      console.log('Raw ADK response type:', typeof responseData);
      if (typeof responseData === 'string') {
        console.log('Raw ADK response:', responseData.substring(0, 500) + 
          (responseData.length > 500 ? '...' : ''));
      } else {
        console.log('Raw ADK response:', JSON.stringify(responseData).substring(0, 500) + 
          (JSON.stringify(responseData).length > 500 ? '...' : ''));
      }
    }
    
    // Parse the agent response
    const finalResponse = parseAgentResponse(responseData);

    if (debugMode) {
      console.log('ADK Final response:', finalResponse);
    }
    
    // Return the formatted response
    const apiResponse: AdkApiResponse = {
      message: finalResponse,
      session_id: finalSessionId,
    };
    
    return NextResponse.json(apiResponse);
    
  } catch (error) {
    const errorMessage = `Error connecting to ADK agent: ${error instanceof Error ? error.message : String(error)}`;
    console.error('Error in ADK route handler:', error);
    console.error(errorMessage);
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 