import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/authUtils';
import { UserUsage } from '@/lib/types/firestore';

// Define plan limits (example - move to config/database later)
const PLAN_LIMITS = {
  Free: {
    messagesLimit: 100,
    projectsLimit: 5,
    tokensLimit: 50000,
  },
  Pro: {
    messagesLimit: 10000,
    projectsLimit: 50,
    tokensLimit: 5000000,
  },
  Enterprise: {
    messagesLimit: Infinity, // Or very high number
    projectsLimit: Infinity,
    tokensLimit: Infinity,
  },
};

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthToken(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;

    // Approach 1: Usage stored directly on user document
    // const userRef = adminDb.collection('users').doc(uid);
    // const userDoc = await userRef.get();
    // if (!userDoc.exists) {
    //   return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // }
    // const userData = userDoc.data() as UserProfile;
    // const usageData = userData.usageCounters;
    // const planTier = userData.planTier;

    // Approach 2: Usage stored in separate 'usage' collection
    const usageRef = adminDb.collection('usage').doc(uid);
    const usageDoc = await usageRef.get();

    if (!usageDoc.exists) {
      // Handle case where usage doc might not exist yet (e.g., new user)
      // Might return default limits for their plan or zeros
      // For now, return 404
      console.warn(`Usage data not found for UID: ${uid}`);
      return NextResponse.json({ error: 'Usage data not found' }, { status: 404 });
    }

    const usageData = usageDoc.data() as UserUsage;
    const planTier = usageData.planTier;

    // Get limits for the user's plan
    const limits = PLAN_LIMITS[planTier] || PLAN_LIMITS.Free; // Default to Free if plan unknown

    // Combine usage data with limits
    const responsePayload = {
      planTier,
      messagesUsed: usageData?.messagesUsed ?? 0,
      messagesLimit: limits.messagesLimit,
      projectsGenerated: usageData?.projectsGenerated ?? 0,
      projectsLimit: limits.projectsLimit,
      tokensUsed: usageData?.tokensUsed ?? 0,
      tokensLimit: limits.tokensLimit,
      // Include period info if needed by the client
      // periodStart: usageData?.periodStart,
      // periodEnd: usageData?.periodEnd,
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('Error fetching user usage:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 