import admin from 'firebase-admin';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Get credentials
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase Admin credentials in environment variables');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail, 
        privateKey,
      })
    });
    
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

// Get default app reference
const adminAuth = getAuth();
// Get specific database reference
const adminDb = getFirestore(admin.app(), 'ai-agent'); // Specify database ID

// Export instances directly
export { adminAuth, adminDb };

// Export getter functions for backward compatibility
export function getAdminAuth(): Auth {
  return adminAuth;
}

export function getAdminDb(): Firestore {
  return adminDb;
}

// Export a function to get the admin app
export function getAdminApp() {
  // This returns the default app
  return admin.app();
}

// Export admin for direct access if needed
export { admin }; 