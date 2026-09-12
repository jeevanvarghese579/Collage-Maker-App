import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { getFirebase } from './config';

function photoPath(uid, id) {
  return `users/${uid}/photos/${id}.jpg`;
}

function framePath(uid, id) {
  return `users/${uid}/frames/${id}.png`;
}

export async function uploadPhoto(uid, id, blob) {
  const { storage } = getFirebase();
  const r = ref(storage, photoPath(uid, id));
  await uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(r);
}

export async function uploadFrame(uid, id, blob) {
  const { storage } = getFirebase();
  const r = ref(storage, framePath(uid, id));
  await uploadBytes(r, blob, { contentType: blob.type || 'image/png' });
  return getDownloadURL(r);
}

export async function deletePhoto(uid, id) {
  const { storage } = getFirebase();
  try {
    await deleteObject(ref(storage, photoPath(uid, id)));
  } catch {
    /* ignore not-found */
  }
}

export async function deleteFrame(uid, id) {
  const { storage } = getFirebase();
  try {
    await deleteObject(ref(storage, framePath(uid, id)));
  } catch {
    /* ignore */
  }
}
