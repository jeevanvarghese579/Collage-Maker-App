import { db, TABLES } from '@/db/dexie';
import { getBlob } from '@/db/blobs';
import { fetchAllCloud, upsertRecord, deleteCloudRecord, clearCloudData } from '@/firebase/firestore';
import { uploadPhoto, uploadFrame } from '@/firebase/storage';
import { SYNC_STATUS } from '@/constants';
import { nowISO } from '@/utils';

const BLOB_FIELDS = { students: ['photoBlobId'], frameTemplates: ['imageBlobId'] };
const ALL_TABLES = ['students', 'categories', 'items', 'participations', 'results', 'frameTemplates'];
let activeSync = null;

function time(record) {
  return new Date(record?.updatedAt || record?.createdAt || 0).getTime();
}

export async function buildSyncPreview(uid) {
  const cloud = await fetchAllCloud(uid);
  const local = {};
  const summary = { local: {}, cloud: {}, new: {}, updated: {}, conflicts: {}, deletes: 0 };
  for (const table of ALL_TABLES) {
    local[table] = await db.table(table).toArray();
    const cloudMap = new Map((cloud[table] || []).map((r) => [r.id, r]));
    summary.local[table] = local[table].length;
    summary.cloud[table] = cloudMap.size;
    summary.new[table] = local[table].filter((r) => !cloudMap.has(r.id)).length;
    summary.updated[table] = local[table].filter((r) => cloudMap.has(r.id) && time(r) !== time(cloudMap.get(r.id))).length;
    summary.conflicts[table] = local[table].filter((r) => cloudMap.has(r.id) && r.syncStatus !== SYNC_STATUS.SYNCED && time(r) < time(cloudMap.get(r.id))).map((r) => r.id);
  }
  summary.deletes = await db.table(TABLES.pendingDeletes).count();
  return { summary, cloud, local };
}

async function syncRecord(uid, table, localRecord, cloudRecord) {
  if (!cloudRecord || (localRecord.syncStatus !== SYNC_STATUS.SYNCED && time(localRecord) >= time(cloudRecord))) {
    const record = { ...localRecord };
    if (table === 'students' && record.photoBlobId && !record.photoStorageUrl) {
      const blob = await getBlob(record.photoBlobId);
      if (blob) record.photoStorageUrl = await uploadPhoto(uid, record.id, blob);
    }
    if (table === 'frameTemplates' && record.imageBlobId && !record.imageStorageUrl) {
      const blob = await getBlob(record.imageBlobId);
      if (blob) record.imageStorageUrl = await uploadFrame(uid, record.id, blob);
    }
    await upsertRecord(uid, table, record, BLOB_FIELDS[table] || []);
    await db.table(table).put({ ...record, syncStatus: SYNC_STATUS.SYNCED });
    return;
  }
  if (time(cloudRecord) > time(localRecord)) {
    await db.table(table).put({ ...cloudRecord, syncStatus: SYNC_STATUS.SYNCED });
  } else if (localRecord.syncStatus !== SYNC_STATUS.SYNCED) {
    await db.table(table).put({ ...localRecord, syncStatus: SYNC_STATUS.SYNCED });
  }
}

async function performSync(uid, onProgress) {
  const { cloud, local } = await buildSyncPreview(uid);
  let step = 0;
  const total = ALL_TABLES.length + 2;
  const tick = (message) => onProgress({ step: ++step, total, message });
  const conflicts = [];

  const deletes = await db.table(TABLES.pendingDeletes).toArray();
  for (const deletion of deletes) {
    const cloudRecord = (cloud[deletion.table] || []).find((r) => r.id === deletion.recordId);
    if (cloudRecord && time(cloudRecord) > new Date(deletion.deletedAt).getTime()) {
      await db.table(deletion.table).put({ ...cloudRecord, syncStatus: SYNC_STATUS.SYNCED });
      conflicts.push({ table: deletion.table, id: deletion.recordId, resolution: 'cloud-newer-than-delete' });
    } else {
      await deleteCloudRecord(uid, deletion.table, deletion.recordId);
    }
    await db.table(TABLES.pendingDeletes).delete(deletion.id);
  }
  tick('Applied pending deletions');

  for (const table of ALL_TABLES) {
    const cloudMap = new Map((cloud[table] || []).map((r) => [r.id, r]));
    const localMap = new Map(local[table].map((r) => [r.id, r]));
    for (const record of local[table]) {
      const cloudRecord = cloudMap.get(record.id);
      if (cloudRecord && record.syncStatus !== SYNC_STATUS.SYNCED && time(cloudRecord) > time(record)) {
        conflicts.push({ table, id: record.id, resolution: 'cloud-newer', localUpdatedAt: record.updatedAt, cloudUpdatedAt: cloudRecord.updatedAt });
      }
      await syncRecord(uid, table, record, cloudRecord);
    }
    for (const cloudRecord of cloud[table] || []) {
      if (!localMap.has(cloudRecord.id)) await db.table(table).put({ ...cloudRecord, syncStatus: SYNC_STATUS.SYNCED });
    }
    tick(`Synchronized ${table}`);
  }
  const completedAt = nowISO();
  await db.table(TABLES.syncMeta).put({ key: 'lastSync', value: completedAt });
  await db.table(TABLES.syncMeta).put({ key: 'lastConflicts', value: conflicts, updatedAt: completedAt });
  await db.table(TABLES.syncMeta).delete('lastSyncError');
  tick('Finalized');
  return { completedAt, conflicts };
}

export function runSync(uid, onProgress = () => {}) {
  if (activeSync) return activeSync;
  activeSync = performSync(uid, onProgress)
    .catch(async (error) => {
      await db.table(TABLES.syncMeta).put({ key: 'lastSyncError', value: error?.message || 'Unknown sync error', updatedAt: nowISO() });
      throw error;
    })
    .finally(() => { activeSync = null; });
  return activeSync;
}

export async function getUnsyncedCount() {
  let count = await db.table(TABLES.pendingDeletes).count();
  for (const table of ALL_TABLES) count += await db.table(table).where('syncStatus').notEqual(SYNC_STATUS.SYNCED).count();
  return count;
}

export async function clearCloud(uid) { await clearCloudData(uid); }
export { clearCloudData };
