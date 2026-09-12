import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { getFirebase } from './config';
import { nowISO, uuid } from '@/utils';
import { SYNC_STATUS } from '@/constants';

function userCol(uid, name) {
  const { firestore } = getFirebase();
  return collection(firestore, 'users', uid, name);
}

function userDoc(uid, name, id) {
  const { firestore } = getFirebase();
  return doc(firestore, 'users', uid, name, id);
}

const TABLES = [
  'students',
  'categories',
  'items',
  'participations',
  'results',
  'frameTemplates',
];

// Strip blob/local fields before writing to Firestore (images live in Storage).
function stripLocal(record, blobFields) {
  const copy = { ...record };
  for (const f of blobFields) delete copy[f];
  delete copy.photoLocalUrl;
  delete copy.imageBlobId;
  delete copy.photoBlobId;
  delete copy.blob;
  return copy;
}

export async function fetchAllCloud(uid) {
  const data = {};
  for (const t of TABLES) {
    const snap = await getDocs(userCol(uid, t));
    data[t] = snap.docs.map((d) => d.data());
  }
  const settingsSnap = await getDocs(userCol(uid, 'settings'));
  data.settings = {};
  settingsSnap.docs.forEach((d) => {
    data.settings[d.id] = d.data();
  });
  return data;
}

export async function upsertRecord(uid, table, record, blobFields = []) {
  const clean = stripLocal(record, blobFields);
  await setDoc(userDoc(uid, table, clean.id), clean, { merge: true });
}

export async function deleteCloudRecord(uid, table, id) {
  await deleteDoc(userDoc(uid, table, id));
}

export async function batchUpsert(uid, table, records, blobFields = []) {
  const { firestore } = getFirebase();
  // Firestore batches limited to 500 writes.
  for (let i = 0; i < records.length; i += 400) {
    const chunk = records.slice(i, i + 400);
    const batch = writeBatch(firestore);
    for (const rec of chunk) {
      const clean = stripLocal(rec, blobFields);
      batch.set(userDoc(uid, table, clean.id), clean, { merge: true });
    }
    await batch.commit();
  }
}

export async function clearCloudData(uid) {
  for (const t of TABLES) {
    const snap = await getDocs(userCol(uid, t));
    const { firestore } = getFirebase();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const chunk = snap.docs.slice(i, i + 400);
      const batch = writeBatch(firestore);
      for (const d of chunk) batch.delete(d.ref);
      await batch.commit();
    }
  }
}

export { nowISO, uuid, SYNC_STATUS };
