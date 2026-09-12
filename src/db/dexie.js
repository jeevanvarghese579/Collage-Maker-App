import Dexie from 'dexie';
import { APP_VERSION } from '@/constants';

export const db = new Dexie('CollageMakerDB');

// IndexedDB schema. Photo blobs are stored in their own object store so we can
// keep student/frame records lightweight and avoid re-encoding blobs on reads.
db.version(1).stores({
  students:
    'id, name, className, rollNumber, admissionNumber, gender, createdAt, updatedAt, syncStatus',
  categories: 'id, name, order, isDefault, createdAt, updatedAt',
  items: 'id, categoryId, name, order, createdAt, updatedAt',
  participations:
    'id, studentId, categoryId, itemId, createdAt, updatedAt, [studentId+itemId]',
  results:
    'id, participationId, studentId, categoryId, itemId, createdAt, updatedAt',
  frameTemplates:
    'id, name, enabled, createdAt, updatedAt',
  blobs: 'id, kind, refId, createdAt',
  settings: 'key',
  syncMeta: 'key',
});

db.version(2).stores({
  students: 'id, name, className, rollNumber, admissionNumber, gender, createdAt, updatedAt, syncStatus',
  categories: 'id, name, order, isDefault, createdAt, updatedAt, syncStatus',
  items: 'id, categoryId, name, order, createdAt, updatedAt, syncStatus',
  participations: 'id, studentId, categoryId, itemId, createdAt, updatedAt, syncStatus, [studentId+itemId]',
  results: 'id, participationId, studentId, categoryId, itemId, createdAt, updatedAt, syncStatus',
  frameTemplates: 'id, name, enabled, createdAt, updatedAt, syncStatus',
  blobs: 'id, kind, refId, createdAt',
  settings: 'key',
  syncMeta: 'key',
  pendingDeletes: 'id, [table+recordId], table, recordId, deletedAt, syncStatus',
});

export const TABLES = {
  students: 'students',
  categories: 'categories',
  items: 'items',
  participations: 'participations',
  results: 'results',
  frameTemplates: 'frameTemplates',
  blobs: 'blobs',
  settings: 'settings',
  syncMeta: 'syncMeta',
  pendingDeletes: 'pendingDeletes',
};

const SYNCED_TABLES = ['students', 'categories', 'items', 'participations', 'results', 'frameTemplates'];
for (const tableName of SYNCED_TABLES) {
  db.table(tableName).hook('deleting', function queueDelete(recordId, record) {
    if (!record) return;
    this.onsuccess = () => {
      db.table('pendingDeletes').put({
        id: `${tableName}:${recordId}`,
        table: tableName,
        recordId,
        deletedAt: new Date().toISOString(),
        syncStatus: 'pending',
      });
    };
  });
}

export async function clearAllLocalData() {
  await Promise.all(
    Object.values(TABLES).map((t) => db.table(t).clear())
  );
}

export async function getRecordCounts() {
  const counts = {};
  for (const [name, t] of Object.entries(TABLES)) {
    counts[name] = await db.table(t).count();
  }
  return counts;
}

export { APP_VERSION };
