import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { logger } from './utils/logger';

// Emulator imports (only needed when using emulators)
// import { connectAuthEmulator } from 'firebase/auth';
// import { connectFirestoreEmulator } from 'firebase/firestore';
// import { connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

// Firebase configuration validated and ready
logger.debug('Firebase configuration validated', undefined, {
  component: 'Firebase',
  operation: 'Initialize',
  extra: {
    environment: process.env.REACT_APP_ENV,
    nodeEnvironment: process.env.NODE_ENV,
    configurationValid: true,
  },
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable Firebase emulator in development (TEMPORARILY DISABLED)
// Uncomment the following block to use emulators
/*
if (
  process.env.NODE_ENV === 'development' &&
  process.env.REACT_APP_ENV === 'development'
) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(db, 'localhost', 8082);
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    // Emulators might already be connected - this is expected in some cases
    // Only log in development
    logger.info('Firebase emulators already connected or unavailable');
  }
}
*/

// Log Firebase initialization status
logger.info('Firebase services initialized', {
  component: 'Firebase',
  operation: 'Initialize',
  extra: {
    mode: 'production',
    servicesReady: true,
  },
});

// Utility function to verify user authentication
export const getCurrentUserId = () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.uid;
};
