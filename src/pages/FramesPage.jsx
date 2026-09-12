import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Trash2,
  Plus,
  Frame as FrameIcon,
  Check,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { useFrameTemplates } from '@/hooks/useDb';
import { db, TABLES } from '@/db/dexie';
import { saveBlob, getBlobUrl, deleteBlob, updateBlobRef, getBlob } from '@/db/blobs';
import { makeFrameTemplate } from '@/db/schema';
import { nowISO, SYNC_STATUS, classNames } from '@/utils';
import { useAppStore } from '@/stores/appStore';
import { useStudentPhoto } from '@/hooks/useApp';
import { useStudents } from '@/hooks/useDb';
import { validateImageFile, fileToImage } from '@/services/imageService';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function FramesPage() {
  const frames = useFrameTemplates();
  const students = useStudents();
  const addToast = useAppStore((s) => s.addToast);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [previewFrame, setPreviewFrame] = useState(null);
  const fileRef = useRef(null);

  async function addFrame() {
    const tmpl = makeFrameTemplate({ name: 'New Frame', enabled: true });
    await db.table(TABLES.frameTemplates).put(tmpl);
    setEditing(tmpl);
    addToast({ type: 'info', message: 'Frame created. Upload a transparent PNG.' });
  }

  async function setActive(id) {
    const all = frames || [];
    const updates = all.map((f) => ({
      ...f,
      enabled: f.id === id,
      updatedAt: nowISO(),
      syncStatus: SYNC_STATUS.PENDING,
    }));
    await db.table(TABLES.frameTemplates).bulkPut(updates);
    await db.table(TABLES.settings).put({ key: 'activeFrameTemplateId', value: id });
    addToast({ type: 'success', message: 'Active frame set.' });
  }

  async function updateFrame(frame, patch) {
    await db.table(TABLES.frameTemplates).put({
      ...frame,
      ...patch,
      updatedAt: nowISO(),
      syncStatus: SYNC_STATUS.PENDING,
    });
  }

  async function deleteFrame(frame) {
    if (frame.imageBlobId) await deleteBlob(frame.imageBlobId);
    await db.table(TABLES.frameTemplates).delete(frame.id);
    addToast({ type: 'success', message: 'Frame deleted.' });
    setConfirmDelete(null);
  }

  async function onUpload(file, frame) {
    const check = validateImageFile(file);
    if (!check.ok) {
      addToast({ type: 'error', message: check.error });
      return;
    }
    if (frame.imageBlobId) await deleteBlob(frame.imageBlobId);
    const id = await saveBlob({ blob: file, kind: 'frame', refId: frame.id });
    await updateFrame(frame, { imageBlobId: id });
    await updateBlobRef(id, frame.id);
    addToast({ type: 'success', message: 'Frame image uploaded.' });
  }

  if (!frames) return null;
  const sampleStudent = (students || [])[0];

  return (
    <div>
      <PageHeader
        title="Frame Template"
        subtitle="Transparent PNG overlays for collage cards"
        actions={
          <button className="btn-primary" onClick={addFrame}>
            <Plus size={16} /> Add Frame
          </button>
        }
      />

      {frames.length === 0 ? (
        <EmptyState
          icon={FrameIcon}
          title="No frame templates"
          description="Add a frame and upload a transparent PNG to overlay on student cards."
          action={<button className="btn-primary" onClick={addFrame}><Plus size={16} /> Add Frame</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {frames.map((f) => (
            <FrameCard
              key={f.id}
              frame={f}
              sampleStudent={sampleStudent}
              onEdit={() => setEditing(f)}
              onDelete={() => setConfirmDelete(f)}
              onSetActive={() => setActive(f.id)}
              onUpload={(file) => onUpload(file, f)}
            />
          ))}
        </div>
      )}

      <FrameEditModal
        frame={editing}
        onClose={() => setEditing(null)}
        onUpdate={(patch) => updateFrame(editing, patch)}
        onPreview={() => setPreviewFrame(editing)}
      />

      <FramePreviewModal frame={previewFrame} sampleStudent={sampleStudent} onClose={() => setPreviewFrame(null)} />

      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title="Delete frame template?"
        message="This removes the frame and its image. Collages will no longer use it."
        confirmLabel="Delete"
        onConfirm={() => deleteFrame(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function FrameCard({ frame, sampleStudent, onEdit, onDelete, onSetActive, onUpload }) {
  const [url, setUrl] = useState(null);
  const samplePhoto = useStudentPhoto(sampleStudent);
  const fileRef = useRef(null);

  useEffect(() => {
    if (frame.imageBlobId) getBlobUrl(frame.imageBlobId).then(setUrl);
    else setUrl(null);
  }, [frame.imageBlobId]);

  return (
    <div className={classNames('card overflow-hidden', frame.enabled && 'ring-2 ring-brand-500')}>
      <div className="relative aspect-[3/4] bg-white grid grid-cols-2 gap-2 p-4">
        <div className="bg-ink-100 rounded flex items-center justify-center overflow-hidden">
          {samplePhoto ? <img src={samplePhoto} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-ink-400">No sample</span>}
        </div>
        <div className="relative bg-ink-100 rounded flex items-center justify-center overflow-hidden">
          {samplePhoto && <img src={samplePhoto} alt="" className="w-full h-full object-cover" />}
          {url && <img src={url} alt="frame" className="absolute inset-0 w-full h-full object-contain" />}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-ink-900 flex-1 truncate">{frame.name}</p>
          {frame.enabled && <span className="chip chip-success">Active</span>}
        </div>
        <div className="flex flex-wrap gap-1 mt-3">
          <button className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={12} /> Image
          </button>
          <button className="btn-ghost btn-sm" onClick={onEdit}><Eye size={12} /> Edit</button>
          {!frame.enabled && <button className="btn-ghost btn-sm text-brand-600" onClick={onSetActive}><Check size={12} /> Set Active</button>}
          <button className="btn-ghost btn-sm text-danger-600" onClick={onDelete}><Trash2 size={12} /></button>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}

function FrameEditModal({ frame, onClose, onUpdate, onPreview }) {
  if (!frame) return null;
  const num = (key) => (e) => onUpdate({ [key]: Number(e.target.value) });
  return (
    <Modal
      open={!!frame}
      onClose={onClose}
      title={frame.name}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onPreview}><Eye size={14} /> Preview</button>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Template name</label>
          <input className="input" value={frame.name} onChange={(e) => onUpdate({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Width scale ({frame.widthScale.toFixed(2)})</label>
            <input type="range" min="0.5" max="2" step="0.05" value={frame.widthScale} onChange={(e) => { onUpdate({ widthScale: Number(e.target.value) }); }} className="w-full accent-brand-600" />
          </div>
          <div>
            <label className="label">Height scale ({frame.heightScale.toFixed(2)})</label>
            <input type="range" min="0.5" max="2" step="0.05" value={frame.heightScale} onChange={(e) => { onUpdate({ heightScale: Number(e.target.value) }); }} className="w-full accent-brand-600" />
          </div>
          <div>
            <label className="label">Horizontal offset ({frame.offsetX}px)</label>
            <input type="range" min="-100" max="100" step="1" value={frame.offsetX} onChange={num('offsetX')} className="w-full accent-brand-600" />
          </div>
          <div>
            <label className="label">Vertical offset ({frame.offsetY}px)</label>
            <input type="range" min="-100" max="100" step="1" value={frame.offsetY} onChange={num('offsetY')} className="w-full accent-brand-600" />
          </div>
          <div>
            <label className="label">Padding ({frame.padding}px)</label>
            <input type="range" min="0" max="50" step="1" value={frame.padding} onChange={num('padding')} className="w-full accent-brand-600" />
          </div>
          <label className="flex items-center gap-2 mt-6">
            <input type="checkbox" checked={frame.enabled} onChange={(e) => onUpdate({ enabled: e.target.checked })} className="accent-brand-600" />
            <span className="text-sm">Enabled</span>
          </label>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => onUpdate({ widthScale: 1, heightScale: 1 })}><RotateCcw size={12} /> Reset size</button>
          <button className="btn-secondary btn-sm" onClick={() => onUpdate({ offsetX: 0, offsetY: 0 })}><RotateCcw size={12} /> Reset position</button>
        </div>
      </div>
    </Modal>
  );
}

function FramePreviewModal({ frame, sampleStudent, onClose }) {
  const [frameUrl, setFrameUrl] = useState(null);
  const samplePhoto = useStudentPhoto(sampleStudent);
  useEffect(() => {
    if (frame?.imageBlobId) getBlobUrl(frame.imageBlobId).then(setFrameUrl);
    else setFrameUrl(null);
  }, [frame?.imageBlobId]);

  return (
    <Modal open={!!frame} onClose={onClose} title="Frame Preview" size="sm" footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="relative aspect-[3/4] bg-white rounded-lg overflow-hidden border border-ink-200">
        <div className="absolute inset-4 bg-ink-100 rounded overflow-hidden">
          {samplePhoto && <img src={samplePhoto} alt="" className="w-full h-full object-cover" />}
        </div>
        {frameUrl && (
          <img
            src={frameUrl}
            alt="frame"
            className="absolute"
            style={{
              width: `${frame.widthScale * 100}%`,
              height: `${frame.heightScale * 100}%`,
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${frame.offsetX}px), calc(-50% + ${frame.offsetY}px))`,
            }}
          />
        )}
      </div>
      <p className="text-xs text-ink-500 mt-3">Preview shows how the frame overlays a sample student card.</p>
    </Modal>
  );
}
