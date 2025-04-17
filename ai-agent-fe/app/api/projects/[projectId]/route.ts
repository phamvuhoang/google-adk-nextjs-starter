import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { admin, adminDb } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/authUtils';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { FirestoreProjectData, ProjectDetailResponse } from '@/lib/types/projects';

// Helper
const serializeTimestamp = (timestamp: AdminTimestamp): string => {
  return timestamp.toDate().toISOString();
};

// GET Handler for /api/projects/[projectId]
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const projectId = params.projectId;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const projectRef = adminDb.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectData = projectDoc.data() as FirestoreProjectData;

    // Authorization Check: User must be the owner
    // TODO: Add collaborator check in the future
    if (projectData.ownerId !== uid /* && !projectData.collaboratorIds?.includes(uid) */) {
        // Also consider isPublic if implementing that
        if (!projectData.isPublic) {
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    // Construct the final response
    // Note: This assumes 'files' array doesn't contain unserializable types like Timestamps.
    // If it does, they need serialization too.
    const responsePayload: ProjectDetailResponse = {
      projectId: projectDoc.id,
      ownerId: projectData.ownerId,
      name: projectData.name,
      description: projectData.description,
      createdAt: serializeTimestamp(projectData.createdAt),
      updatedAt: serializeTimestamp(projectData.updatedAt),
      sessionId: projectData.sessionId,
      storagePath: projectData.storagePath,
      boltContainerId: projectData.boltContainerId,
      previewURL: projectData.previewURL,
      collaboratorIds: projectData.collaboratorIds,
      isPublic: projectData.isPublic,
      files: projectData.files, // Pass file metadata directly
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error(`Error fetching project ${params.projectId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH Handler for /api/projects/[projectId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const projectId = params.projectId;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const body = await request.json();
    // Define fields allowed for update
    const { name, description /*, action, prompt */ } = body;

    const projectRef = adminDb.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectData = projectDoc.data() as FirestoreProjectData;

    // Authorization Check: Only owner can update (or collaborators with edit role later)
    if (projectData.ownerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prepare updates - only include fields that were actually provided in the request
    const updates: Partial<FirestoreProjectData> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    // Handle other actions like regeneration later

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
    }

    // Add updatedAt timestamp
    updates.updatedAt = admin.firestore.Timestamp.now();

    await projectRef.update(updates);

    // Fetch the updated document to return it
    const updatedDoc = await projectRef.get();
    const updatedData = updatedDoc.data() as FirestoreProjectData;

    // Construct the response
    const responsePayload: Partial<ProjectDetailResponse> = {
        projectId: updatedDoc.id,
        name: updatedData.name,
        description: updatedData.description,
        updatedAt: serializeTimestamp(updatedData.updatedAt),
        // Include other relevant fields from updatedData if needed
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error(`Error updating project ${params.projectId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE Handler for /api/projects/[projectId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const projectId = params.projectId;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const projectRef = adminDb.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      // Return 204 even if not found, as the desired state (deleted) is achieved
      return new NextResponse(null, { status: 204 });
    }

    const projectData = projectDoc.data() as FirestoreProjectData;

    // Authorization Check: Only owner can delete
    if (projectData.ownerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // --- Optional: Delete associated resources (e.g., files in Storage) ---
    if (projectData.storagePath) {
      try {
        // Example: Delete folder in Firebase Storage
        // Need to initialize adminStorage in admin.ts
        // const bucket = adminStorage.bucket(); // Default bucket
        // await bucket.deleteFiles({ prefix: `${projectData.storagePath}/` });
        console.log(`TODO: Implement deletion for storage path: ${projectData.storagePath}`);
      } catch (storageError) {
        console.error(`Error deleting storage files for project ${projectId}:`, storageError);
        // Decide if failure to delete storage should prevent Firestore deletion
        // For now, we'll proceed but log the error.
      }
    }
    // --- End Optional Resource Deletion ---

    // Delete the Firestore document
    await projectRef.delete();

    // Return success with No Content
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error(`Error deleting project ${params.projectId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 