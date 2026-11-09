import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
};

export function Sheet({ open, onClose, children, ariaLabel }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="bidi-sheet-root" role="presentation">
      <button
        type="button"
        className="bidi-sheet-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="bidi-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="bidi-sheet-handle" aria-hidden />
        {children}
      </div>
    </div>,
    document.body,
  );
}
