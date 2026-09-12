import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { useEscapeKey } from '@/hooks/useUi';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);
  useEscapeKey(() => open && onCancel?.());

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div
          className={`shrink-0 rounded-full p-3 ${
            danger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          <AlertTriangle size={24} />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
          {message && (
            <p className="mt-1 text-sm text-ink-600 leading-relaxed">{message}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
