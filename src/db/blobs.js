import { db, TABLES } from './dexie';
import { makeBlob } from './schema';
import { uuid } from '@/utils';

// Blobs (photos, frames) are stored in IndexedDB, never Base64 in Firestore.
export async function saveBlob({ blob, kind = 'photo', refId = null, id }) {
  const record = makeBlob({
    id: id || uuid(),
    kind,
    refId,
    blob,
    mimeType: blob.type || 'image/jpeg',
  });
  await db.table(TABLES.blobs).put(record);
  return record.id;
}

export async function getBlob(id) {
  if (!id) return null;
  const record = await db.table(TABLES.blobs).get(id);
  return record ? record.blob : null;
}

export async function getBlobRecord(id) {
  if (!id) return null;
  return db.table(TABLES.blobs).get(id);
}

export async function deleteBlob(id) {
  if (!id) return;
  await db.table(TABLES.blobs).delete(id);
}

export async function updateBlobRef(id, refId) {
  if (!id) return;
  const rec = await db.table(TABLES.blobs).get(id);
  if (rec) {
    rec.refId = refId;
    await db.table(TABLES.blobs).put(rec);
  }
}

// Cache of object URLs so we don't recreate per render. Expires on reload,
// but blobs persist in IndexedDB and are re-read on demand.
const urlCache = new Map();

export async function getBlobUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await getBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export function revokeBlobUrl(id) {
  if (urlCache.has(id)) {
    URL.revokeObjectURL(urlCache.get(id));
    urlCache.delete(id);
  }
}

export function clearUrlCache() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

export async function getAllBlobs() {
  return db.table(TABLES.blobs).toArray();
}

export async function getStorageUsage() {
  const blobs = await db.table(TABLES.blobs).toArray();
  let bytes = 0;
  for (const b of blobs) {
    if (b.blob && b.blob.size) bytes += b.blob.size;
  }
  return { bytes, count: blobs.length };
}
