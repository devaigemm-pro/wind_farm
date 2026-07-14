import { useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  variant?: ToastVariant;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss: () => void;
  autoDismiss?: boolean;
  autoDismissMs?: number;
}

const variantConfig: Record<
  ToastVariant,
  { icon: LucideIcon; color: string; bgColor: string }
> = {
  success: {
    icon: CheckCircle,
    color: 'var(--color-success-500)',
    bgColor: '#D1FAE5',
  },
  error: {
    icon: AlertCircle,
    color: 'var(--color-danger-500)',
    bgColor: '#FEE2E2',
  },
  info: {
    icon: Info,
    color: 'var(--color-info-500)',
    bgColor: 'var(--color-primary-50)',
  },
  warning: {
    icon: AlertTriangle,
    color: 'var(--color-warning-500)',
    bgColor: '#FEF3C7',
  },
};

export function Toast({
  variant = 'info',
  message,
  action,
  onDismiss,
  autoDismiss = true,
  autoDismissMs = 5000,
}: ToastProps) {
  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!autoDismiss) return;
    const timer = setTimeout(handleDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismiss, autoDismissMs, handleDismiss]);

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const toastStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    backgroundColor: 'var(--color-neutral-0)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--color-neutral-200)',
    fontFamily: 'var(--font-family-sans)',
    maxWidth: '400px',
    width: '100%',
  };

  const iconWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: config.bgColor,
    color: config.color,
  };

  const messageStyle: React.CSSProperties = {
    flex: 1,
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-800)',
    margin: 0,
  };

  const actionButtonStyle: React.CSSProperties = {
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    color: 'var(--color-primary-500)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-family-sans)',
  };

  const dismissButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-400)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={toastStyle}
    >
      <div style={iconWrapperStyle}>
        <IconComponent size={16} aria-hidden="true" />
      </div>
      <p style={messageStyle}>{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={actionButtonStyle}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        style={dismissButtonStyle}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}
