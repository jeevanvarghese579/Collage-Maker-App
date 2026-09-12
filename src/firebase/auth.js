import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
} from 'firebase/auth';
import { getFirebase, isFirebaseConfigured } from './config';

export async function loginEmailPassword(email, password) {
  const { auth } = getFirebase();
  if (!auth) throw new Error('Firebase is not configured. Add credentials to .env.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginGoogle() {
  const { auth } = getFirebase();
  if (!auth) throw new Error('Firebase is not configured. Add credentials to .env.');
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
}

export async function resetPassword(email) {
  const { auth } = getFirebase();
  if (!auth) throw new Error('Firebase is not configured. Add credentials to .env.');
  await sendPasswordResetEmail(auth, email);
}

export async function sendCurrentUserVerification() {
  const { auth } = getFirebase();
  if (!auth?.currentUser) throw new Error('Sign in before requesting email verification.');
  await sendEmailVerification(auth.currentUser);
}

export async function refreshCurrentUser() {
  const { auth } = getFirebase();
  if (!auth?.currentUser) return null;
  await reload(auth.currentUser);
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

export async function signUpEmailPassword(email, password, displayName) {
  const { auth } = getFirebase();
  if (!auth) throw new Error('Firebase is not configured. Add credentials to .env.');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  return cred.user;
}

export async function logout() {
  const { auth } = getFirebase();
  if (auth) await signOut(auth);
}

export function subscribeAuth(cb) {
  if (!isFirebaseConfigured()) return () => {};
  const { auth } = getFirebase();
  return onAuthStateChanged(auth, cb);
}
