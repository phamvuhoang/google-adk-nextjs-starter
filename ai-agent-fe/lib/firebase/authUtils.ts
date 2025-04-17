import { adminAuth } from './admin';
import { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';

/**
 * Verifies the Firebase ID token from the Authorization header.
 * @param request The NextRequest object.
 * @returns The decoded token if valid, otherwise null.
 */
export async function verifyAuthToken(
  request: NextRequest
): Promise<DecodedIdToken | null> {
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const idToken = authorization.split('Bearer ')[1];
    if (!idToken) {
      return null;
    }
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      console.error('Error verifying auth token:', error);
      return null;
    }
  } else {
    console.warn('No Bearer token found in Authorization header.');
    return null;
  }
} 