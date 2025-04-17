import { Timestamp } from 'firebase/firestore';

/**
 * Types for the Chat Interface UI components
 */

/**
 * Raw message format as received from the API/Firestore
 */
export interface RawMessage {
    messageId: string;
    sender: 'user' | 'assistant' | 'system';
    text: string;
    createdAt: string | Timestamp; // Could be string (ISO) or Firestore Timestamp
    role?: 'user' | 'assistant' | 'system';
    metadata?: Record<string, unknown>;
    next_actions?: string[];
}

/**
 * Message format used for display within the component state
 * Uses Date objects for better display and optimistic UI
 */
export interface DisplayMessage {
    messageId: string;
    sender: 'user' | 'assistant' | 'system';
    text: string;
    createdAt: Date | null; // Consistent Date object for display
    role?: 'user' | 'assistant' | 'system';
    metadata?: Record<string, unknown>;
    next_actions?: string[];
    processing?: boolean;
    isStreaming?: boolean; // Optional flag for streaming state
}

/**
 * Props for the ChatInterface component
 */
export interface ChatInterfaceProps {
    sessionId: string;
    initialMessages?: DisplayMessage[];
}

/**
 * API response format for assistant messages
 */
export interface AssistantApiResponse {
    messageId: string;
    text: string;
    role: 'assistant';
    next_actions?: string[];
    processing?: boolean;
    sessionId?: string; // API may return session ID
    error?: string;
    message?: string;
}
