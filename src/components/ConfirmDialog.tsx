import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,.5)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: '20px 20px 16px',
          maxWidth: 360,
          width: '100%',
          boxShadow: '0 8px 32px var(--shadow)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8 }}>
          {title}
        </h3>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              fontWeight: 500,
              background: 'var(--surface-2)',
              color: 'var(--text)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              fontWeight: 600,
              background: destructive ? 'var(--loss)' : 'var(--accent)',
              color: destructive ? '#fff' : 'var(--on-accent)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
