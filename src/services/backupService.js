import JSZip from 'jszip';
import { db, TABLES, getRecordCounts } from '@/db/dexie';
import { getAllBlobs } from '@/db/blobs';
import {
  BACKUP_SCHEMA_VERSION,
  APP_VERSION,
  APP_NAME,
} from '@/constants';
import { downloadBlob, nowISO } from '@/utils';
import { APP_KEY } from '@/firebase/paths';

export async function createBackup() {
  const zip = new JSZip();
  const meta = {
    appKey: APP_KEY,
    app: APP_NAME,
    appVersion: APP_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: nowISO(),
    counts: await getRecordCounts(),
  };
  zip.file('meta.json', JSON.stringify(meta, null, 2));

  for (const name of Object.values(TABLES)) {
    const rows = await db.table(name).toArray();
    zip.file(`${name}.json`, JSON.stringify(rows, null, 2));
  }

  const blobs = await getAllBlobs();
  const blobsDir = zip.folder('blobs');
  const blobsMeta = [];
  for (const b of blobs) {
    if (!b.blob) continue;
    const ext = (b.mimeType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
    const filename = `${b.id}.${ext}`;
    const buf = await b.blob.arrayBuffer();
    blobsDir.file(filename, buf);
    blobsMeta.push({ id: b.id, filename, kind: b.kind, refId: b.refId, mimeType: b.mimeType });
  }
  zip.file('blobs.json', JSON.stringify(blobsMeta, null, 2));

  const out = await zip.generateAsync({ type: 'blob' });
  return out;
}

export async function downloadBackup() {
  const blob = await createBackup();
  downloadBlob(blob, `collage-maker-backup-${new Date().toISOString().slice(0, 10)}.zip`);
}

export async function previewBackup(file) {
  const zip = await JSZip.loadAsync(file);
  const metaFile = zip.file('meta.json');
  if (!metaFile) throw new Error('Invalid backup: meta.json missing.');
  const meta = JSON.parse(await metaFile.async('string'));
  return { meta, zip };
}

export async function restoreBackup(file, { mode = 'replace' } = {}) {
  const zip = await JSZip.loadAsync(file);
  const meta = JSON.parse(await zip.file('meta.json').async('string'));
  if (meta.appKey !== undefined && meta.appKey !== APP_KEY) {
    throw new Error('This backup belongs to a different application.');
  }

  const tableNames = [
    'students',
    'categories',
    'items',
    'participations',
    'results',
    'frameTemplates',
    'settings',
    'syncMeta',
  ];

  if (mode === 'replace') {
    for (const t of tableNames) {
      await db.table(t).clear();
    }
    await db.table(TABLES.blobs).clear();
  }

  const report = { restored: {}, blobs: 0 };
  for (const t of tableNames) {
    const f = zip.file(`${t}.json`);
    if (!f) continue;
    const rows = JSON.parse(await f.async('string'));
    if (rows.length) {
      if (mode === 'merge') {
        // upsert
        await db.table(t).bulkPut(rows);
      } else {
        await db.table(t).bulkPut(rows);
      }
    }
    report.restored[t] = rows.length;
  }

  const blobsMetaFile = zip.file('blobs.json');
  if (blobsMetaFile) {
    const blobsMeta = JSON.parse(await blobsMetaFile.async('string'));
    for (const b of blobsMeta) {
      const f = zip.file(`blobs/${b.filename}`);
      if (!f) continue;
      const buf = await f.async('arraybuffer');
      const blob = new Blob([buf], { type: b.mimeType || 'image/jpeg' });
      await db.table(TABLES.blobs).put({
        id: b.id,
        kind: b.kind,
        refId: b.refId,
        blob,
        mimeType: b.mimeType,
        createdAt: b.createdAt || nowISO(),
      });
      report.blobs++;
    }
  }

  return { meta, report };
}
