import { useEffect, useRef } from 'react';
import { Button } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const resolvedConfirmLabel = confirmLabel ?? t('confirmDialog.confirm');
  const resolvedCancelLabel = cancelLabel ?? t('confirmDialog.cancel');
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
    padding: 'var(--space-4)',
  };

  const dialogStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-neutral-0)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-xl)',
    padding: 'var(--space-6)',
    maxWidth: '420px',
    width: '100%',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-lg)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-900)',
  };

  const messageStyle: React.CSSProperties = {
    margin: 'var(--space-3) 0 var(--space-6)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-500)',
    lineHeight: 1.5,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--space-3)',
  };

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div style={dialogStyle}>
        <h2 id="confirm-dialog-title" style={titleStyle}>
          {title}
        </h2>
        <p id="confirm-dialog-message" style={messageStyle}>
          {message}
        </p>
        <div style={actionsStyle}>
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
          >
            {resolvedCancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
