import { Toast } from '@/components/molecules';
import { useToastStore } from '@/store/toastStore';

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 'var(--space-4)',
    right: 'var(--space-4)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    maxWidth: '400px',
    width: '100%',
    pointerEvents: 'none',
  };

  const itemStyle: React.CSSProperties = {
    pointerEvents: 'auto',
  };

  if (toasts.length === 0) return null;

  return (
    <div style={containerStyle} aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} style={itemStyle}>
          <Toast
            variant={toast.variant}
            message={toast.message}
            action={toast.action}
            onDismiss={() => removeToast(toast.id)}
            autoDismiss={toast.autoDismiss}
            autoDismissMs={toast.autoDismissMs}
          />
        </div>
      ))}
    </div>
  );
}
