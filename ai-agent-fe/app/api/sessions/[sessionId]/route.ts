import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/authUtils';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { 
  FirestoreSessionData, 
  FirestoreMessageData, 
  MessageResponse, 
  SessionDetailResponse 
} from '@/lib/types/sessions';

// Helper
const serializeTimestamp = (timestamp: AdminTimestamp): string => {
  return timestamp.toDate().toISOString();
};

// GET Handler for /api/sessions/[sessionId]
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const { sessionId } = await Promise.resolve(params);

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const sessionRef = adminDb.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = sessionDoc.data() as FirestoreSessionData;

    // Authorization Check: User must be the owner
    // TODO: Add collaborator check in the future
    if (sessionData.ownerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch messages for the session
    const messagesQuery = sessionRef.collection('messages').orderBy('createdAt', 'asc');
    const messagesSnapshot = await messagesQuery.get();

    const messages: MessageResponse[] = messagesSnapshot.docs.map((doc) => {
      const msgData = doc.data() as FirestoreMessageData;
      return {
        messageId: doc.id,
        sender: msgData.sender,
        text: msgData.text,
        createdAt: serializeTimestamp(msgData.createdAt),
        role: msgData.role,
        metadata: msgData.metadata,
        next_actions: msgData.next_actions || [],
      };
    });

    // Construct the final response
    const responsePayload: SessionDetailResponse = {
      sessionId: sessionDoc.id,
      ownerId: sessionData.ownerId,
      title: sessionData.title,
      createdAt: serializeTimestamp(sessionData.createdAt),
      updatedAt: serializeTimestamp(sessionData.updatedAt),
      status: sessionData.status,
      projectId: sessionData.projectId,
      messages: messages,
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error(`Error fetching session ${params.sessionId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE Handler for /api/sessions/[sessionId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const { sessionId } = await Promise.resolve(params);

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const sessionRef = adminDb.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return new NextResponse(null, { status: 204 }); // Already deleted or never existed
    }

    const sessionData = sessionDoc.data() as FirestoreSessionData;

    // Authorization Check: Only owner can delete
    // TODO: Add collaborator/admin check if needed
    if (sessionData.ownerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // --- Delete Subcollection (Messages) --- 
    // Firestore doesn't automatically delete subcollections.
    // We need to delete messages manually or use a Cloud Function extension.
    // This can be slow for many messages. Consider batching or background task.
    const messagesRef = sessionRef.collection('messages');
    const messagesSnapshot = await messagesRef.limit(500).get(); // Limit batch size
    if (!messagesSnapshot.empty) {
        const batch = adminDb.batch();
        messagesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        // TODO: Handle sessions with > 500 messages (e.g., recursive delete function)
        console.warn(`Deleted ${messagesSnapshot.size} messages for session ${sessionId}. More might exist.`);
    }
    // --- End Subcollection Deletion ---

    // Delete the main session document
    await sessionRef.delete();

    return new NextResponse(null, { status: 204 }); // Success, No Content

  } catch (error) {
    console.error(`Error deleting session ${params.sessionId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH handler for /api/sessions/[sessionId] (e.g., archive) can be added here later 