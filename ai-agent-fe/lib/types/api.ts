// API-related types for the AI Agent application

/**
 * Interface for ADK agent response formats.
 * Handles various response structures that the ADK might return.
 */
export interface AdkResponse {
    events?: Array<{
        event_type: string;
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
    final_response?: { text: string };
    response?: string;
    text?: string;
    content?: string | Record<string, unknown>;
    message?: {
        content?: {
            parts?: Array<{ text?: string }>;
            next_actions?: string[];
        }
    } | string | Record<string, unknown>;
    next_actions?: string[];
    [key: string]: unknown;
}

/**
 * Request body format for the ADK agent.
 */
export interface AdkAgentRequest {
    input: string;
    user_id: string;
    session_id: string;
}

/**
 * Alternative request body format for the ADK agent's /run endpoint.
 */
export interface AdkRunRequest {
    user_id: string;
    session_id: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
}

/**
 * Request format for the ADK proxy API in our Next.js app.
 */
export interface AdkMessageRequest {
    session_id?: string;
    input?: string;
    message?: string;
}

/**
 * Event structure from the ADK agent response.
 */
export interface AdkEvent {
    content?: {
        parts?: {
            text?: string;
            [key: string]: unknown;
        }[];
        [key: string]: unknown;
    };
    role?: string;
    id?: string;
    timestamp?: number;
    [key: string]: unknown;
}

/**
 * Formatted response from our ADK proxy API.
 */
export interface AdkFormattedResponse {
    response: string;
    rawEvents?: AdkEvent[];
    sessionId: string;
    error?: string;
    details?: string;
} 