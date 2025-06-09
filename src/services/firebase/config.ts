// Firebase configuration
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Configure Firestore to handle connection issues
const configureFirestore = async () => {
  try {
    // Force enable network to reset connection state
    await enableNetwork(firestore);
    console.log('Firestore network enabled successfully');
  } catch (error) {
    console.warn('Firestore network configuration warning:', error);
    
    // If there are persistent connection issues, try to disable and re-enable
    try {
      await disableNetwork(firestore);
      setTimeout(async () => {
        await enableNetwork(firestore);
        console.log('Firestore network reset completed');
      }, 1000);
    } catch (resetError) {
      console.error('Firestore network reset failed:', resetError);
    }
  }
};

// Initialize Firestore configuration on module load
configureFirestore();

// Initialize Realtime Database with proper typing
const database: Database = (() => {
  try {
    if (firebaseConfig.databaseURL) {
      return getDatabase(app);
    }
    throw new Error('Database URL not provided');
  } catch (error) {
    console.error("Realtime Database initialization failed:", error);
    throw error;
  }
})();

export { app, auth, firestore, database };
