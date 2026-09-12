import { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Database,
  Trash2,
  RefreshCw,
  HardDrive,
  Image as ImageIcon,
  AlertTriangle,
  ExternalLink,
  Info,
  Sparkles,
} from 'lucide-react';
import {
  downloadBackup,
  previewBackup,
  restoreBackup,
} from '@/services/backupService';
import { clearAllLocalData, getRecordCounts, TABLES } from '@/db/dexie';
import { getStorageUsage } from '@/db/blobs';
import { ensureSeedData, loadDemoData, clearDemoData } from '@/db/migrations';
import { useAppStore } from '@/stores/appStore';
import { runSync, getUnsyncedCount, clearCloud } from '@/services/syncService';
import { formatBytes, formatDate } from '@/utils';
import { APP_NAME, APP_VERSION, DEVELOPER, DEVELOPER_LINK } from '@/constants';
import PageHeader from '@/components/common/PageHeader';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { Spinner } from '@/components/common/Spinner';

export default function SettingsPage() {
  const { user, mode, addToast, setSyncStatus, setSyncProgress, setLastSyncedAt } = useAppStore();
  const [busy, setBusy] = useState(null);
  const [counts, setCounts] = useState(null);
  const [storage, setStorage] = useState(null);
  const [unsynced, setUnsynced] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [confirmClear, setConfirmClear] = useState(null);
  const restoreRef = useRef(null);

  async function refreshStats() {
    setBusy('stats');
    try {
      setCounts(await getRecordCounts());
      setStorage(await getStorageUsage());
      setUnsynced(await getUnsyncedCount());
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateBackup() {
    setBusy('backup');
    try {
      await downloadBackup();
      addToast({ type: 'success', message: 'Backup created.' });
    } catch (e) {
      addToast({ type: 'error', message: `Backup failed: ${e.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function onRestoreFile(e) {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { meta } = await previewBackup(file);
        setRestorePreview({ file, meta });
      } catch (err) {
        addToast({ type: 'error', message: err.message });
      }
    }
    e.target.value = '';
  }

  async function doRestore(mode) {
    setBusy('restore');
    try {
      // Safety backup first.
      await downloadBackup();
      const { meta, report } = await restoreBackup(restorePreview.file, { mode });
      addToast({ type: 'success', message: `Restored backup (${mode}). Records: ${Object.values(report.restored).reduce((a, b) => a + b, 0)}, blobs: ${report.blobs}.` });
      setRestorePreview(null);
      await ensureSeedData();
    } catch (e) {
      addToast({ type: 'error', message: `Restore failed: ${e.message}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleClearLocal() {
    setBusy('clearLocal');
    try {
      await clearAllLocalData();
      await ensureSeedData();
      addToast({ type: 'success', message: 'Local data cleared. Defaults restored.' });
    } finally {
      setBusy(null);
      setConfirmClear(null);
    }
  }

  async function handleClearCloud() {
    if (!user) {
      addToast({ type: 'info', message: 'Sign in to clear cloud data.' });
      return;
    }
    setBusy('clearCloud');
    try {
      await clearCloud(user.uid);
      addToast({ type: 'success', message: 'Cloud data cleared.' });
    } catch (e) {
      addToast({ type: 'error', message: e.message });
    } finally {
      setBusy(null);
      setConfirmClear(null);
    }
  }

  async function handleRetrySync() {
    if (!user) {
      addToast({ type: 'info', message: 'Sign in first.' });
      return;
    }
    setBusy('sync');
    setSyncStatus('syncing');
    try {
      await runSync(user.uid, (p) => setSyncProgress(p));
      setLastSyncedAt(new Date().toISOString());
      setSyncStatus('success');
      addToast({ type: 'success', message: 'Sync complete.' });
    } catch (e) {
      setSyncStatus('error');
      addToast({ type: 'error', message: e.message });
    } finally {
      setBusy(null);
      setSyncProgress(null);
    }
  }

  async function handleDemo() {
    setBusy('demo');
    try {
      const r = await loadDemoData();
      addToast({ type: 'success', message: `Demo data loaded: ${r.students} students.` });
    } finally {
      setBusy(null);
    }
  }

  async function handleClearDemo() {
    setBusy('clearDemo');
    try {
      await clearDemoData();
      addToast({ type: 'success', message: 'All data cleared and defaults restored.' });
    } finally {
      setBusy(null);
      setConfirmClear(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Backup, restore, data tools and about"
        actions={
          <button className="btn-secondary" onClick={refreshStats} disabled={busy === 'stats'}>
            {busy === 'stats' ? <Spinner /> : <RefreshCw size={16} />} Refresh Stats
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backup & restore */}
        <section className="card p-5">
          <h2 className="font-display font-bold text-ink-900 flex items-center gap-2 mb-4">
            <Database size={18} /> Backup & Restore
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button className="btn-primary" onClick={handleCreateBackup} disabled={busy === 'backup'}>
              {busy === 'backup' ? <Spinner /> : <Download size={16} />} Create Backup
            </button>
            <button className="btn-secondary" onClick={() => restoreRef.current?.click()} disabled={busy === 'restore'}>
              <Upload size={16} /> Restore Backup
            </button>
            <input ref={restoreRef} type="file" accept=".zip" className="hidden" onChange={onRestoreFile} />
          </div>
          <p className="text-sm text-ink-500">
            Exports a ZIP containing all records, photos, frame templates, presets and settings.
            Restoring first creates a safety backup automatically.
          </p>
        </section>

        {/* Database stats */}
        <section className="card p-5">
          <h2 className="font-display font-bold text-ink-900 flex items-center gap-2 mb-4">
            <HardDrive size={18} /> Database Statistics
          </h2>
          {counts ? (
            <dl className="text-sm space-y-1.5">
              {Object.entries(counts).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-ink-100 pb-1">
                  <dt className="text-ink-600 capitalize">{k}</dt>
                  <dd className="font-semibold text-ink-900">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-2">
                <dt className="text-ink-600 flex items-center gap-1"><ImageIcon size={14} /> Image storage</dt>
                <dd className="font-semibold text-ink-900">{formatBytes(storage?.bytes)} ({storage?.count} files)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Unsynced records</dt>
                <dd className="font-semibold text-ink-900">{unsynced}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-500">Click "Refresh Stats" to load.</p>
          )}
        </section>

        {/* Data tools */}
        <section className="card p-5">
          <h2 className="font-display font-bold text-ink-900 flex items-center gap-2 mb-4">
            <RefreshCw size={18} /> Data Tools
          </h2>
          <div className="space-y-2">
            <button className="btn-secondary w-full justify-start" onClick={handleRetrySync} disabled={busy === 'sync'}>
              {busy === 'sync' ? <Spinner /> : <RefreshCw size={16} />} Retry failed synchronization
            </button>
            <button className="btn-secondary w-full justify-start" onClick={handleDemo} disabled={busy === 'demo'}>
              <Sparkles size={16} /> Load demo data
            </button>
            <div className="pt-2 border-t border-ink-100 mt-2 space-y-2">
              <p className="text-xs font-semibold uppercase text-ink-400 flex items-center gap-1"><AlertTriangle size={12} /> Danger zone</p>
              <button className="btn-danger w-full justify-start" onClick={() => setConfirmClear({ type: 'demo' })} disabled={busy}>
                <Trash2 size={16} /> Remove all data (restore defaults)
              </button>
              <button className="btn-danger w-full justify-start" onClick={() => setConfirmClear({ type: 'local' })} disabled={busy}>
                <Trash2 size={16} /> Clear all local data
              </button>
              <button className="btn-danger w-full justify-start" onClick={() => setConfirmClear({ type: 'cloud' })} disabled={busy || !user}>
                <Trash2 size={16} /> Clear cloud data {mode === 'offline' && '(sign in first)'}
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="card p-5">
          <h2 className="font-display font-bold text-ink-900 flex items-center gap-2 mb-4">
            <Info size={18} /> About
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">App</span><span className="font-semibold">{APP_NAME}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Version</span><span className="font-semibold">{APP_VERSION}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Developer</span><span className="font-semibold">{DEVELOPER}</span></div>
            <a
              href={DEVELOPER_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline font-medium mt-3"
            >
              Visit itsjeevanvarghese.web.app for more software <ExternalLink size={14} />
            </a>
          </div>
        </section>
      </div>

      {/* Restore preview modal */}
      <Modal
        open={!!restorePreview}
        onClose={() => setRestorePreview(null)}
        title="Restore Backup"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRestorePreview(null)}>Cancel</button>
            <button className="btn-secondary" onClick={() => doRestore('merge')} disabled={busy === 'restore'}>
              {busy === 'restore' ? <Spinner /> : null} Merge with existing
            </button>
            <button className="btn-danger" onClick={() => doRestore('replace')} disabled={busy === 'restore'}>
              {busy === 'restore' ? <Spinner /> : null} Replace existing data
            </button>
          </>
        }
      >
        {restorePreview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="chip">v{restorePreview.meta.schemaVersion}</span>
              <span className="chip">{formatDate(restorePreview.meta.createdAt)}</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink-700 mb-2">Record counts in backup</h4>
              <dl className="text-sm grid grid-cols-2 gap-1">
                {Object.entries(restorePreview.meta.counts || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-ink-100 py-0.5">
                    <dt className="text-ink-600 capitalize">{k}</dt><dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="text-sm text-ink-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              A safety backup of your current data will be created automatically before restoring.
              "Replace" wipes all current data; "Merge" adds/overwrites by ID.
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmClear}
        danger
        title="Dangerous action"
        message={
          confirmClear?.type === 'cloud'
            ? 'This permanently deletes ALL your cloud data. Local data remains. Continue?'
            : confirmClear?.type === 'demo'
            ? 'This removes ALL students, participations, results, frames and restores default categories. Continue?'
            : 'This clears all local data. A backup is recommended first. Continue?'
        }
        confirmLabel="Yes, proceed"
        onConfirm={() => {
          if (confirmClear.type === 'local') handleClearLocal();
          else if (confirmClear.type === 'cloud') handleClearCloud();
          else if (confirmClear.type === 'demo') handleClearDemo();
        }}
        onCancel={() => setConfirmClear(null)}
      />
    </div>
  );
}
