import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/authUtils';

// Define expected request body shape (optional)
interface GenerateRequestBody {
  projectName?: string;
  techStack?: string; // Example options
  // Add other generation parameters
}

// Define expected response shape (might include status, projectId, URLs)
interface GenerateResponse {
  status: 'generating' | 'completed' | 'failed';
  message: string;
  projectId?: string;
  previewURL?: string;
  downloadURL?: string; // Or storage path
}

// POST Handler for /api/sessions/[sessionId]/generate
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const sessionId = params.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const body: GenerateRequestBody = await request.json();

    // --- Authorization Check (Session Owner/Collaborator) ---
    const sessionRef = adminDb.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists || sessionDoc.data()?.ownerId !== uid) {
        // TODO: Add collaborator check
        return NextResponse.json({ error: 'Forbidden or Session not found' }, { status: 403 });
    }
    // --- End Check ---

    // --- Usage/Rate Limit Check ---
    // TODO: Implement check against user's plan limits (e.g., projectsGenerated)
    // Fetch usage data from /usage/{uid} or user doc
    // If limit reached, return 429 or 402
    const canGenerate = true; // Placeholder
    if (!canGenerate) {
        return NextResponse.json({ error: 'Usage limit exceeded' }, { status: 429 });
    }
    // --- End Check ---

    // --- AI Backend Interaction Placeholder ---
    console.log(`Triggering project generation for session: ${sessionId}`);
    console.log('Generation Params:', body);
    // TODO: Send request to your AI backend service (ADK/Bolt.new)
    // Pass sessionId, uid, generation params (body), conversation context
    // Example: const generationResult = await triggerAIProjectGeneration(sessionId, uid, body);

    // This might be asynchronous. The AI backend could directly write the project
    // doc to Firestore and maybe update the session doc.
    // The response here could indicate the process has started.

    const responsePayload: GenerateResponse = {
        status: 'generating', // Or 'completed' if synchronous and successful
        message: 'Project generation initiated.',
        // projectId: generationResult.projectId, // If available immediately
        // previewURL: generationResult.previewURL,
    };
    // --- End AI Placeholder ---

    // --- Optional: Update Usage Counters ---
    // TODO: Atomically increment projectsGenerated counter in /usage/{uid} or user doc
    // await adminDb.collection('usage').doc(uid).update({
    //     projectsGenerated: admin.firestore.FieldValue.increment(1)
    // });
    // --- End Usage Update ---

    // Return status (e.g., 202 Accepted if async)
    return NextResponse.json(responsePayload, { status: 202 });

  } catch (error) {
    console.error(`Error generating project for session ${params.sessionId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 