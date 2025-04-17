import { 
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    Timestamp 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import './config'; // Ensure Firebase is initialized
import { UserProfile } from '@/lib/types/firestore'; // Import the UserProfile type

const db = getFirestore();

/**
 * Initializes or updates a user's profile in Firestore upon login/signup.
 * Creates the profile document if it doesn't exist.
 * Optionally updates the name if the Firestore profile lacks one but the Auth user has it.
 * 
 * @param user The Firebase Auth User object.
 */
export const initializeUserProfile = async (user: User): Promise<void> => {
    if (!user || !user.uid) {
        console.error("initializeUserProfile called with invalid user object");
        return;
    }

    const userRef = doc(db, "users", user.uid);
    
    try {
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            // User profile doesn't exist, create it
            const newUserProfile: UserProfile = {
                uid: user.uid,
                email: user.email || ' ', // Ensure email is not null
                name: user.displayName || undefined, // Use undefined if null
                planTier: 'Free', // Default plan
                createdAt: serverTimestamp() as Timestamp, // Use serverTimestamp for creation
                updatedAt: serverTimestamp() as Timestamp,
                // Initialize usage counters if needed
                // usageCounters: {
                //   month: new Date().toISOString().slice(0, 7), // e.g., "2024-07"
                //   messagesUsed: 0,
                //   projectsGenerated: 0,
                // },
                settings: {},
            };
            await setDoc(userRef, newUserProfile);
            console.log("Created new user profile for:", user.email);
        } else {
            // User profile exists, check if update needed (e.g., name from Google Sign-In)
            const existingProfile = docSnap.data() as UserProfile;
            const updates: Partial<UserProfile> = {};

            // If Firestore profile has no name, but Auth user does, update it.
            if (!existingProfile.name && user.displayName) {
                updates.name = user.displayName;
            }

            // Always update the last updated time on login/check
            updates.updatedAt = serverTimestamp() as Timestamp;
            
            if (Object.keys(updates).length > 1) { // Check if more than just updatedAt needs update
                await updateDoc(userRef, updates);
                 console.log("Updated user profile for:", user.email);
            } else {
                // Only update timestamp if no other changes are needed
                await updateDoc(userRef, { updatedAt: serverTimestamp() as Timestamp });
            }
           
        }
    } catch (error) {
        console.error("Error initializing/updating user profile:", error);
        // Consider more robust error handling/logging
    }
};
