import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { admin, adminDb } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/authUtils';
import { UserProfile } from '@/lib/types/firestore';
import type { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Optionally create a profile if it doesn't exist, or return 404
      // For now, let's assume it should exist if the user is authenticated.
      console.warn(`User profile not found for UID: ${uid}`);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Ensure data conforms to UserProfile interface (important for type safety)
    // Firestore data might be missing fields if not properly managed
    const userData = userDoc.data() as UserProfile;

    // Return only necessary profile fields, excluding sensitive info if any
    const userProfile: Partial<UserProfile> = {
      uid: userData.uid,
      email: userData.email,
      name: userData.name,
      planTier: userData.planTier,
      // Omit timestamps or other fields if not needed by client immediately
      // createdAt: userData.createdAt,
      // updatedAt: userData.updatedAt,
      usageCounters: userData.usageCounters,
      settings: userData.settings,
    };

    return NextResponse.json(userProfile);

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper to convert Admin Timestamps to ISO strings
const serializeTimestamp = (timestamp: AdminTimestamp): string => {
    return timestamp.toDate().toISOString();
};

// PATCH Handler for /api/users/me
export async function PATCH(request: NextRequest) {
    try {
        const decodedToken = await verifyAuthToken(request);
        if (!decodedToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const uid = decodedToken.uid;
        const body = await request.json();

        // Define allowable update fields (e.g., name, specific settings)
        const { name, settings } = body;
        const updates: Partial<Pick<UserProfile, 'name' | 'settings'>> = {};

        if (name !== undefined && typeof name === 'string') {
            updates.name = name;
        }
        if (settings !== undefined && typeof settings === 'object' && settings !== null) {
            // TODO: Add validation for settings structure if necessary
            updates.settings = settings;
        }
        // Add other updatable fields here (e.g., specific preferences)

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
        }

        // Add updatedAt timestamp
        const updateDataWithTimestamp = {
            ...updates,
            updatedAt: admin.firestore.Timestamp.now(),
        };

        const userRef = adminDb.collection('users').doc(uid);
        await userRef.update(updateDataWithTimestamp);

        // Fetch the updated document to return it
        const updatedDoc = await userRef.get();
        if (!updatedDoc.exists) {
             // Should not happen if update succeeded, but good practice to check
            return NextResponse.json({ error: 'User not found after update' }, { status: 404 });
        }
        const updatedData = updatedDoc.data() as UserProfile;

        // Return relevant parts of the updated profile
        const responsePayload: Partial<Pick<UserProfile, 'uid' | 'email' | 'name' | 'planTier' | 'settings'> & { updatedAt: string }> = {
            uid: updatedData.uid,
            email: updatedData.email,
            name: updatedData.name,
            planTier: updatedData.planTier,
            updatedAt: serializeTimestamp(updatedData.updatedAt as AdminTimestamp),
            settings: updatedData.settings,
        };

        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error('Error updating user profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH handler for /api/users/me can be added here later 