import { Timestamp } from 'firebase/firestore'; // Use client-side Timestamp for potential frontend use

// Or use firebase-admin Timestamp if these types are strictly backend
// import { Timestamp } from 'firebase-admin/firestore';

export interface UserProfile {
  uid: string; // Corresponds to Firebase Auth UID and document ID
  email: string;
  name?: string;
  planTier: 'Free' | 'Pro' | 'Enterprise'; // Enforce plan types
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Optional: Direct usage counters on user doc (simpler) or separate collection
  usageCounters?: {
    month: string; // e.g., "2024-07"
    messagesUsed: number;
    projectsGenerated: number;
    tokensUsed?: number; // Optional tracking
  };
  settings?: Record<string, unknown>; // Use Record<string, unknown> instead of any
}

export interface Session {
  sessionId: string; // Document ID
  ownerId: string; // UID of the user who created it
  title?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  projectId?: string; // Link to the generated project, if any
  status?: 'active' | 'archived' | 'completed';
  // Future: collaboratorIds?: string[];
}

export interface Message {
  messageId: string; // Document ID
  sender: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: Timestamp;
  role?: 'user' | 'assistant' | 'system'; // Explicit role (optional, often same as sender)
  next_actions?: string[]; // Suggested next actions for assistant messages
  metadata?: {
    codeAttached?: boolean;
    projectId?: string; // If this message resulted in project generation
    toolInfo?: Record<string, unknown>; // Use Record<string, unknown> instead of any
    // Add other relevant metadata
  };
  // For access control if not relying solely on parent session:
  // ownerId?: string;
}

export interface ProjectFile {
 path: string;
 content?: string; // Content might be stored elsewhere (Storage) for large files
 size?: number;
 // Or perhaps a storageRef if content is in Firebase Storage
 storageRef?: string;
}

export interface Project {
  projectId: string; // Document ID
  ownerId: string; // UID of the user who owns it
  name: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sessionId?: string; // Link back to the originating session
  files?: ProjectFile[]; // Array of file metadata/content (consider size limits)
  storagePath?: string; // Path in Firebase Storage (e.g., to a ZIP or folder)
  boltContainerId?: string; // If using Bolt.new persistence
  previewURL?: string; // Live preview URL from Bolt.new or other service
  collaboratorIds?: string[]; // Future: UIDs of collaborators
  // Future: roles?: { [uid: string]: 'editor' | 'viewer' };
  isPublic?: boolean; // Default false
}

// Consider using a subcollection for collaborators if roles become complex
// export interface ProjectMember {
//   uid: string;
//   role: 'editor' | 'viewer';
// }
// projects/{projectId}/members/{uid} -> ProjectMember


export interface UserUsage {
  userId: string; // Document ID (matches User UID)
  planTier: 'Free' | 'Pro' | 'Enterprise';
  periodStart: Timestamp;
  periodEnd?: Timestamp; // Optional, might be calculated based on plan/start
  messagesUsed: number;
  projectsGenerated: number;
  tokensUsed?: number;
  lastUpdated: Timestamp;
}

// Optional: Subcollection for detailed logs
export interface UsageLog {
  logId: string; // Document ID
  timestamp: Timestamp;
  action: 'message' | 'generation' | 'tool_call' | string; // Type of action
  increment: number; // How much was used (e.g., 1 message, 500 tokens)
  unit: 'messages' | 'projects' | 'tokens' | string; // Unit of increment
  context?: { // Optional context like session or project ID
    sessionId?: string;
    projectId?: string;
  };
}
// usage/{userId}/logs/{logId} -> UsageLog 