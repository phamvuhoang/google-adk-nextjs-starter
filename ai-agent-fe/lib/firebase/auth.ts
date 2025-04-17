import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    signOut as firebaseSignOutInternal, 
    GoogleAuthProvider, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    User, 
    NextOrObserver 
} from 'firebase/auth';
import './config'; // Ensure Firebase is initialized
import { FirebaseError } from 'firebase/app';

const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

// Function to map Firebase error codes to user-friendly messages
function mapAuthCodeToMessage(errorCode: string): string {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/user-disabled':
            return 'This user account has been disabled.';
        case 'auth/user-not-found':
            return 'No user found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'This email address is already in use.';
        case 'auth/weak-password':
            return 'Password is too weak. Please choose a stronger password.';
        case 'auth/operation-not-allowed':
            return 'Email/password sign-in is not enabled.';
        default:
            return 'An unknown authentication error occurred.';
    }
}

// --- Authentication State Observer ---
export const onAuthStateChange = (callback: NextOrObserver<User>) => {
  return onAuthStateChanged(auth, callback);
};

// --- Sign Up with Email and Password ---
export const signUpWithEmailPassword = async (email: string, password: string, displayName?: string): Promise<User | null> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Optionally update profile with display name immediately after signup
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        // Reload user to get updated profile info (optional, depends on flow)
        // await userCredential.user.reload(); 
        // const updatedUser = auth.currentUser;
        // console.log('User signed up and profile updated:', updatedUser?.displayName);
        // return updatedUser;
      }
      console.log('User signed up successfully:', userCredential.user?.email);
      return userCredential.user;
    } catch (error: unknown) {
      console.error('Error signing up:', error);
      if (error instanceof FirebaseError) {
        throw new Error(mapAuthCodeToMessage(error.code));
      } else {
          throw new Error('An unknown error occurred during sign up.');
      }
    }
  };

// --- Sign In with Email and Password ---
export const signInWithEmailPassword = async (email: string, password: string): Promise<User | null> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('User signed in successfully:', userCredential.user?.email);
      return userCredential.user;
    } catch (error: unknown) {
      console.error('Error signing in:', error);
      if (error instanceof FirebaseError) {
        throw new Error(mapAuthCodeToMessage(error.code));
      } else {
           throw new Error('An unknown error occurred during sign in.');
      }
    }
  };

// --- Sign In with Google (Keep for potential future use or alternative) ---
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // This gives you a Google Access Token. You can use it to access the Google API.
    // const credential = GoogleAuthProvider.credentialFromResult(result);
    // const token = credential?.accessToken;
    // The signed-in user info.
    const user = result.user;
    console.log('User signed in with Google:', user?.displayName);
    return user;
  } catch (error: unknown) {
    console.error('Error signing in with Google:', error);
    if (error instanceof FirebaseError) {
      throw new Error(mapAuthCodeToMessage(error.code));
    } else {
        throw new Error('An unknown error occurred during Google sign in.');
    }
  }
};

// --- Sign Out ---
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOutInternal(auth);
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

// --- Get Current User ---
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
}; 