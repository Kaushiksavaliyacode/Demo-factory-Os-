
import { initializeApp } from "firebase/app";
import { 
  initializeFirestore,
  enableMultiTabIndexedDbPersistence, 
  enableIndexedDbPersistence 
} from "firebase/firestore";

// Credentials removed to prevent affecting the main production database.
// Paste your new Demo Firebase project config here.
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "demo-project-placeholder",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * Initialize Firestore with long-polling enabled.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Enable Offline Persistence
const enablePersistence = async () => {
  try {
    await enableMultiTabIndexedDbPersistence(db);
    console.log("Persistence ready");
  } catch (err: any) {
    if (err.code == 'unimplemented') {
        try {
            await enableIndexedDbPersistence(db);
        } catch (innerErr) {
            console.warn("Persistence unavailable", innerErr);
        }
    }
  }
};

enablePersistence();
