import { collection, doc } from 'firebase/firestore';
import { getFirebase } from './config';

export const APP_KEY = 'collageMaker';

export function userCollection(uid, name) {
  return collection(getFirebase().firestore, 'apps', APP_KEY, 'users', uid, name);
}

export function userDocument(uid, name, id) {
  return doc(getFirebase().firestore, 'apps', APP_KEY, 'users', uid, name, id);
}

export const photoPath = (uid, id) => `apps/${APP_KEY}/users/${uid}/photos/${id}.jpg`;
export const framePath = (uid, id) => `apps/${APP_KEY}/users/${uid}/frames/${id}.png`;

