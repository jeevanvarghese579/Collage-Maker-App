import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import PhotoCropper from '@/components/common/PhotoCropper';
import { GENDERS } from '@/constants';
import { db, TABLES } from '@/db/dexie';
import { saveBlob, getBlobUrl, deleteBlob, updateBlobRef } from '@/db/blobs';
import { makeStudent } from '@/db/schema';
import { fileToImage, validateImageFile, clipboardEventToImageFile } from '@/services/imageService';
import { useAppStore } from '@/stores/appStore';
import { nowISO, SYNC_STATUS } from '@/utils';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  gender: z.string().optional().default(''),
  rollNumber: z.string().optional().default(''),
  admissionNumber: z.string().optional().default(''),
  className: z.string().min(1, 'Class is required'),
});

export default function StudentFormModal({ open, onClose, editing, onSaved }) {
  const addToast = useAppStore((s) => s.addToast);
  const [photoBlobId, setPhotoBlobId] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [cropState, setCropState] = useState({ crop: { x: 0, y: 0 }, zoom: 1, rotation: 0 });
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const dropRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', gender: '', rollNumber: '', admissionNumber: '', className: '' },
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        reset({
          name: editing.name || '',
          gender: editing.gender || '',
          rollNumber: editing.rollNumber || '',
          admissionNumber: editing.admissionNumber || '',
          className: editing.className || '',
        });
        setPhotoBlobId(editing.photoBlobId || null);
        setCropState({
          crop: editing.photoCrop || { x: 0, y: 0 },
          zoom: editing.photoZoom || 1,
          rotation: editing.photoRotation || 0,
        });
        if (editing.photoBlobId) {
          getBlobUrl(editing.photoBlobId).then(setPhotoUrl);
        } else {
          setPhotoUrl(null);
        }
      } else {
        reset({ name: '', gender: '', rollNumber: '', admissionNumber: '', className: '' });
        setPhotoBlobId(null);
        setPhotoUrl(null);
        setCropState({ crop: { x: 0, y: 0 }, zoom: 1, rotation: 0 });
      }
    }
  }, [open, editing, reset]);

  async function handleFile(file) {
    const check = validateImageFile(file);
    if (!check.ok) {
      addToast({ type: 'error', message: check.error });
      return;
    }
    const img = await fileToImage(file);
    const ratio = img.width / img.height;
    const target = 3 / 4;
    if (Math.abs(ratio - target) < 0.02) {
      // Already 3:4 — store directly.
      setRawImageSrc(null);
      await saveCroppedPhoto({ blob: file, crop: { x: 0, y: 0 }, zoom: 1, rotation: 0 });
    } else {
      const url = URL.createObjectURL(file);
      setRawImageSrc(url);
      setCropperOpen(true);
    }
  }

  async function saveCroppedPhoto({ blob, crop, zoom, rotation }) {
    setBusy(true);
    try {
      if (photoBlobId) await deleteBlob(photoBlobId);
      const id = await saveBlob({ blob, kind: 'photo' });
      setPhotoBlobId(id);
      const url = URL.createObjectURL(blob);
      setPhotoUrl(url);
      setCropState({ crop, zoom, rotation });
    } finally {
      setBusy(false);
    }
  }

  function onFileInput(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onPaste(e) {
    const file = clipboardEventToImageFile(e);
    if (file) handleFile(file);
  }

  useEffect(() => {
    if (open) {
      window.addEventListener('paste', onPaste);
      return () => window.removeEventListener('paste', onPaste);
    }
  }, [open]);

  async function removePhoto() {
    if (photoBlobId) await deleteBlob(photoBlobId);
    setPhotoBlobId(null);
    setPhotoUrl(null);
  }

  async function onSubmit(values) {
    setBusy(true);
    try {
      if (editing) {
        const updated = {
          ...editing,
          ...values,
          photoBlobId,
          photoCrop: cropState.crop,
          photoZoom: cropState.zoom,
          photoRotation: cropState.rotation,
          updatedAt: nowISO(),
          syncStatus: SYNC_STATUS.PENDING,
        };
        if (photoBlobId) await updateBlobRef(photoBlobId, updated.id);
        await db.table(TABLES.students).put(updated);
        addToast({ type: 'success', message: 'Student updated.' });
        await onSaved?.({ student: updated, isNew: false });
      } else {
        const student = makeStudent({
          ...values,
          photoBlobId,
          photoCrop: cropState.crop,
          photoZoom: cropState.zoom,
          photoRotation: cropState.rotation,
        });
        await db.table(TABLES.students).put(student);
        if (photoBlobId) await updateBlobRef(photoBlobId, student.id);
        addToast({ type: 'success', message: 'Student added.' });
        await onSaved?.({ student, isNew: true });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? 'Edit Student' : 'Add Student'}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSubmit(onSubmit)} disabled={busy}>
              {busy ? <Spinner /> : null}
              {editing ? 'Save Changes' : 'Add Student'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Photo */}
          <div
            ref={dropRef}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors ${
              dragOver ? 'border-brand-500 bg-brand-50' : 'border-ink-200'
            }`}
          >
            <div className="w-24 h-32 rounded-lg bg-ink-100 overflow-hidden flex items-center justify-center shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="Student" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="text-ink-300" size={28} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-700">Student Photo</p>
              <p className="text-xs text-ink-500 mt-0.5">
                3:4 portrait. Upload, drag & drop, or paste (Ctrl+V).
              </p>
              <div className="flex gap-2 mt-3">
                <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> Upload
                </button>
                {photoUrl && (
                  <button type="button" className="btn-ghost btn-sm text-danger-600" onClick={removePhoto}>
                    <Trash2 size={14} /> Remove
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileInput} />
            </div>
            {busy && <Loader2 className="animate-spin text-brand-600" size={20} />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Name *</label>
              <input className="input" {...register('name')} placeholder="Full name" />
              {errors.name && <p className="text-xs text-danger-600 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Class *</label>
              <input className="input" {...register('className')} placeholder="e.g. 8A" />
              {errors.className && <p className="text-xs text-danger-600 mt-1">{errors.className.message}</p>}
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="select" {...register('gender')}>
                <option value="">—</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Roll Number</label>
              <input className="input" {...register('rollNumber')} placeholder="Optional" />
            </div>
            <div>
              <label className="label">Admission Number</label>
              <input className="input" {...register('admissionNumber')} placeholder="Duplicates allowed" />
            </div>
          </div>
        </form>
      </Modal>
      <PhotoCropper
        open={cropperOpen}
        imageSrc={rawImageSrc}
        onClose={() => setCropperOpen(false)}
        onSave={async (result) => {
          await saveCroppedPhoto(result);
          setCropperOpen(false);
        }}
      />
    </>
  );
}
