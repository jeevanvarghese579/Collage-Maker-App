import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useUi';
import { classNames } from '@/utils';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-7xl',
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}) {
  useEscapeKey(() => open && onClose?.());

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm animate-fade-in"
        onClick={() => closeOnBackdrop && onClose?.()}
      />
      <div
        className={classNames(
          'relative w-full bg-white rounded-2xl shadow-lift animate-scale-in max-h-[90vh] flex flex-col',
          SIZES[size]
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
            <button
              onClick={onClose}
              className="btn-icon btn-ghost"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
        {footer && (
          <div className="border-t border-ink-100 px-6 py-4 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
