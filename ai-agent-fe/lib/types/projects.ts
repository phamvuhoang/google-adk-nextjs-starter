import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { ProjectFile } from './firestore';

/**
 * Internal Firestore data structure for project documents
 */
export interface FirestoreProjectData {
  ownerId: string;
  name: string;
  description?: string;
  createdAt: AdminTimestamp;
  updatedAt: AdminTimestamp;
  sessionId?: string;
  storagePath?: string;
  boltContainerId?: string;
  previewURL?: string;
  collaboratorIds?: string[]; // Future
  isPublic?: boolean;
  // Representing files: Option 1: Simple array on the doc (for metadata)
  files?: ProjectFile[]; // Assumes ProjectFile uses basic types or client Timestamp
  // Option 2: Subcollection projects/{projectId}/files
}

/**
 * Project summary data structure returned to client
 */
export interface ProjectSummaryResponse {
  projectId: string;
  ownerId: string;
  name: string;
  description?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  previewURL?: string;
  sessionId?: string;
  // Add flags if needed, e.g., isShared: boolean
}

/**
 * Project detail data structure returned to client
 */
export interface ProjectDetailResponse {
  projectId: string;
  ownerId: string;
  name: string;
  description?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  sessionId?: string;
  storagePath?: string;
  boltContainerId?: string;
  previewURL?: string;
  collaboratorIds?: string[]; // Future
  isPublic?: boolean;
  files?: ProjectFile[]; // File metadata
} 