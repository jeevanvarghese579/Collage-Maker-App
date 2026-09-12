import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';

export default function CsvPreviewModal({
  open,
  onClose,
  result,
  onConfirm,
  title = 'Import Preview',
  confirmLabel = 'Import',
}) {
  const [busy, setBusy] = useState(false);
  if (!result) return null;
  const hasIssues = result.missing.length > 0;
  const headerOk = !hasIssues;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={busy || (hasIssues && result.valid.length === 0)}
          >
            {busy ? <Spinner /> : <FileUp size={16} />}
            {confirmLabel} ({result.valid.length})
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <span className={`chip ${headerOk ? 'chip-success' : 'chip-danger'}`}>
            {headerOk ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {headerOk ? 'Headers valid' : `${result.missing.length} missing column(s)`}
          </span>
          <span className="chip">{result.rawCount} rows</span>
          <span className="chip chip-success">{result.valid.length} valid</span>
          <span className="chip chip-danger">{result.invalid.length} invalid</span>
        </div>

        {hasIssues && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">Missing required columns:</p>
            <p className="mt-1">{result.missing.join(', ')}</p>
          </div>
        )}

        {result.valid.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-ink-700 mb-2">Valid rows preview</h4>
            <div className="overflow-x-auto rounded-lg border border-ink-200 max-h-56">
              <table className="w-full text-sm">
                <thead className="bg-ink-50">
                  <tr>
                    {Object.keys(result.valid[0]).map((k) => (
                      <th key={k} className="table-header px-3 py-2">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.valid.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-ink-100">
                      {Object.values(r).map((v, j) => (
                        <td key={j} className="px-3 py-1.5 text-ink-700">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result.invalid.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-ink-700 mb-2">Invalid rows (will be skipped)</h4>
            <div className="overflow-y-auto rounded-lg border border-ink-200 max-h-40 text-sm">
              {result.invalid.slice(0, 20).map((r, i) => (
                <div key={i} className="border-b border-ink-100 px-3 py-2 last:border-0">
                  <span className="font-medium text-ink-700">Row {r.row}:</span>{' '}
                  <span className="text-ink-600">{r.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
