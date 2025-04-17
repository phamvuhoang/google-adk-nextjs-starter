import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb /*, adminStorage */ } from '@/lib/firebase/admin'; // Need adminStorage
import { verifyAuthToken } from '@/lib/firebase/authUtils';

// Define expected response shape
interface DownloadResponse {
  downloadURL?: string;
  error?: string;
  message?: string;
}

// GET Handler for /api/projects/[projectId]/download
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

    const projectData = projectDoc.data();

    // Authorization Check
    if (projectData?.ownerId !== uid /* && !projectData.collaboratorIds?.includes(uid) */) {
         // TODO: Add collaborator check
         // TODO: Check isPublic if applicable
         return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storagePath = projectData?.storagePath;
    if (!storagePath) {
        return NextResponse.json({ error: 'Project has no downloadable files (no storagePath)' }, { status: 404 });
    }

    // --- Generate Signed URL Placeholder ---
    console.log(`Generating download URL for project ${projectId}, path: ${storagePath}`);
    // TODO: Implement Firebase Storage signed URL generation
    // Requires initializing adminStorage in admin.ts
    try {
      // const bucket = adminStorage.bucket();
      // const fileRef = bucket.file(storagePath); // Assuming storagePath points to a zip
      // const [url] = await fileRef.getSignedUrl({
      //   action: 'read',
      //   expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      // });
      const placeholderUrl = `https://storage.googleapis.com/your-bucket/${storagePath}`; // Placeholder

      const responsePayload: DownloadResponse = {
          downloadURL: placeholderUrl, // Replace with actual signed URL
          message: 'Download link generated successfully.'
      };
      return NextResponse.json(responsePayload);

    } catch (storageError) {
        console.error(`Error generating signed URL for ${storagePath}:`, storageError);
        return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 });
    }
    // --- End Placeholder ---

  } catch (error) {
    console.error(`Error processing download for project ${params.projectId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 