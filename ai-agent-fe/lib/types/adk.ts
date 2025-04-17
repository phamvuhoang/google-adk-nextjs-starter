/**
 * Types related to ADK integration
 */

/**
 * ADK message part representation
 */
export interface AdkPart {
  text?: string;
  mime_type?: string;
}

/**
 * ADK message content structure
 */
export interface AdkMessageContent {
  parts: AdkPart[];
  next_actions?: string[];
}

/**
 * Structured ADK message
 */
export interface AdkMessage {
  content: AdkMessageContent;
}

/**
 * Message part format for request processing
 */
export interface MessagePart {
  text?: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * Request payload for ADK API
 */
export interface AdkRequestPayload {
  app_name: string;
  user_id: string;
  session_id: string;
  new_message: {
    role: string;
    parts: { text: string }[];
  };
}

/**
 * ADK session creation payload
 */
export interface AdkSessionPayload {
  state: Record<string, unknown>;
}

/**
 * ADK API response format
 */
export interface AdkApiResponse {
  message: AdkMessage;
  session_id: string;
  error?: string;
  messageId?: string;
}

/**
 * ADK Event content structure from ADK API
 */
export interface AdkEventContent {
  parts: {
    text?: string;
    [key: string]: unknown;
  }[];
  role?: string;
}

/**
 * ADK Event actions structure
 */
export interface AdkEventActions {
  state_delta: Record<string, unknown>;
  artifact_delta: Record<string, unknown>;
  requested_auth_configs: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * ADK Event structure from direct API response
 */
export interface AdkEvent {
  content?: AdkEventContent;
  author?: string;
  invocation_id?: string;
  actions?: AdkEventActions;
  id?: string;
  timestamp?: number;
  [key: string]: unknown;
} 