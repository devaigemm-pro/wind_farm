import { Download, Loader2 } from 'lucide-react';

export interface ExportButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function ExportButton({ onClick, loading = false }: ExportButtonProps) {
  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-4)',
    backgroundColor: loading ? '#1E8449' : '#27AE60',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background-color var(--duration-fast) var(--easing-default)',
    letterSpacing: '0.025em',
    whiteSpace: 'nowrap',
    opacity: loading ? 0.8 : 1,
  };

  return (
    <button
      type="button"
      style={buttonStyle}
      onClick={onClick}
      disabled={loading}
      aria-label="Export defects list"
      onMouseEnter={(e) => {
        if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1E8449';
      }}
      onMouseLeave={(e) => {
        if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#27AE60';
      }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      Export List
    </button>
  );
}
