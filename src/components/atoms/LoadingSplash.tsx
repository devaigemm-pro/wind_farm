/**
 * Full-viewport loading splash used as the single loading indicator
 * during auth bootstrap and lazy-route chunk loading.
 * Prevents flicker by being the only loading UI shown.
 */
export function LoadingSplash() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100%',
        background: 'var(--color-bg, #ffffff)',
      }}
      aria-label="Loading"
      role="status"
    >
      <div
        style={{
          width: '2.5rem',
          height: '2.5rem',
          border: '3px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'kiro-spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes kiro-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
