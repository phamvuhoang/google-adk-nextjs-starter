import { Timestamp } from 'firebase-admin/firestore';

/**
 * Structure for ADK Events returned from ADK agent
 */
export interface AdkEvent {
    event_type: string;
    content?: {
        parts?: Array<{ text?: string }>;
    };
}

/**
 * Internal Firestore data structure for session documents
 */
export interface FirestoreSessionData {
  ownerId: string;
  title?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'active' | 'archived' | 'completed';
  projectId?: string;
  // collaboratorIds?: string[]; // Future
}

/**
 * Internal Firestore data structure for message documents
 */
export interface FirestoreMessageData {
  sender: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: Timestamp;
  role?: 'user' | 'assistant' | 'system';
  metadata?: Record<string, unknown>;
  next_actions?: string[]; // Add support for next actions suggested by the assistant
}

/**
 * Message data structure returned to client
 */
export interface MessageResponse {
  messageId: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: string; // ISO string
  role?: 'user' | 'assistant' | 'system';
  metadata?: Record<string, unknown>;
  next_actions?: string[]; // Add support for next actions suggested by the assistant
}

/**
 * Session summary data structure returned to client
 */
export interface SessionSummaryResponse {
  sessionId: string;
  ownerId: string;
  title?: string;
  updatedAt: string; // ISO string
  createdAt: string; // ISO string
  projectId?: string;
  status?: 'active' | 'archived' | 'completed';
}

/**
 * Session detail data structure returned to client
 */
export interface SessionDetailResponse {
  sessionId: string;
  ownerId: string;
  title?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  status: 'active' | 'archived' | 'completed';
  projectId?: string;
  messages: MessageResponse[];
  // collaboratorIds?: string[]; // Future
}

/**
 * Assistant message data structure returned to client
 */
export interface AssistantMessageResponse {
  messageId: string;
  sender: 'assistant';
  text: string;
  createdAt: string; // ISO string
  role: 'assistant';
  metadata?: Record<string, unknown>;
  next_actions?: string[]; // Add support for next actions suggested by the assistant
}

/**
 * Response type for session creation
 */
export interface CreateSessionResponse {
  sessionId: string;
  ownerId: string;
  title?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  status: 'active' | 'archived' | 'completed';
  projectId?: string;
  initialAssistantMessage: AssistantMessageResponse | null;
} 