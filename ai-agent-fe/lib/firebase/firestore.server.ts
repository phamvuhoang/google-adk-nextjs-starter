import { adminDb, admin } from './admin';

/**
 * Adds a message to a specific session's subcollection in Firestore.
 * Updates the session's updatedAt timestamp.
 * This function is intended for server-side use only.
 *
 * @param sessionId The ID of the session.
 * @param sender The sender of the message ('user' or 'assistant').
 * @param text The text content of the message.
 * @param next_actions Optional array of suggested next actions (for assistant messages).
 * @param metadata Optional metadata to include with the message.
 * @returns The ID of the newly added message document.
 */
export const addMessageToSession = async (
    sessionId: string,
    sender: 'user' | 'assistant',
    text: string,
    next_actions?: string[],
    metadata?: Record<string, unknown>
): Promise<string> => {
    if (!sessionId) {
        throw new Error("Session ID is required to add a message.");
    }

    // Use admin Firestore for server-side operations
    if (!adminDb) {
        console.error("Admin Firestore not initialized. Cannot add message to session.");
        throw new Error("Database connection error");
    }

    const messagesRef = adminDb.collection(`sessions/${sessionId}/messages`);
    const sessionRef = adminDb.doc(`sessions/${sessionId}`);

    try {
        // Add the new message
        const messageData = {
            sender,
            text,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(next_actions && next_actions.length > 0 && { next_actions }), // Add next_actions if provided
            ...(metadata && { metadata }), // Conditionally add metadata
        };
        const docRef = await messagesRef.add(messageData);

        // Update the session's updatedAt timestamp
        await sessionRef.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        console.log(`Added ${sender} message to session ${sessionId}, message ID: ${docRef.id}`);
        return docRef.id; // Return the new message ID
    } catch (error) {
        console.error(`Error adding message to session ${sessionId}:`, error);
        throw new Error(`Failed to add message: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * Helper function to check and ensure session document exists
 * This function is intended for server-side use only.
 */
export async function ensureSessionExists(sessionId: string, userId: string): Promise<void> {
    try {
        const sessionRef = adminDb.doc(`sessions/${sessionId}`);
        const sessionDoc = await sessionRef.get();
        
        if (!sessionDoc.exists) {
            console.log(`Creating new session document for session ${sessionId}`);
            await sessionRef.set({
                sessionId,
                userId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            });
            console.log(`Created new session document for session ${sessionId}`);
        }
    } catch (error) {
        console.error(`Error ensuring session exists: ${error}`);
        throw new Error(`Failed to ensure session exists: ${error instanceof Error ? error.message : String(error)}`);
    }
} 