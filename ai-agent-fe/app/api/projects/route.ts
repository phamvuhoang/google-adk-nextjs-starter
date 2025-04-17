import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/authUtils';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { FirestoreProjectData, ProjectSummaryResponse } from '@/lib/types/projects';

// Helper
const serializeTimestamp = (timestamp: AdminTimestamp): string => {
  return timestamp.toDate().toISOString();
};

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;

    // Query projects owned by the user
    // TODO: Add filtering for collaboratorIds in the future
    const projectsQuery = adminDb
      .collection('projects')
      .where('ownerId', '==', uid)
      .orderBy('updatedAt', 'desc');
      // .limit(20); // Optional: Add pagination

    const querySnapshot = await projectsQuery.get();

    const projects: ProjectSummaryResponse[] = querySnapshot.docs.map((doc) => {
      const data = doc.data() as FirestoreProjectData;
      return {
        projectId: doc.id,
        ownerId: data.ownerId,
        name: data.name,
        description: data.description,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        previewURL: data.previewURL,
        sessionId: data.sessionId,
      };
    });

    return NextResponse.json(projects);

  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST handler will go here 