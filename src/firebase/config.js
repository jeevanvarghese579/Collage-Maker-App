import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

let app = null;
let auth = null;
let firestore = null;
let storage = null;
let functions = null;

export function getFirebase() {
  if (app) return { app, auth, firestore, storage, functions };
  if (!isFirebaseConfigured()) {
    return { app: null, auth: null, firestore: null, storage: null, functions: null };
  }
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  firestore = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app, 'us-central1');
  return { app, auth, firestore, storage, functions };
}

export function getFirebaseAppId() {
  return firebaseConfig.appId;
}

export function resetFirebaseForTest() {
  app = null;
  auth = null;
  firestore = null;
  storage = null;
  functions = null;
}
