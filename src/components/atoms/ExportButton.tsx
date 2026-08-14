import { Download, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/design-system';

export interface ExportButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function ExportButton({ onClick, loading = false }: ExportButtonProps) {
  const { t } = useLanguage();
  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-4)',
    backgroundColor: loading ? '#4A7A4A' : '#5A8F5A',
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
      aria-label={t('misc.exportDefects')}
      onMouseEnter={(e) => {
        if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#4A7A4A';
      }}
      onMouseLeave={(e) => {
        if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#5A8F5A';
      }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {t('export.list')}
    </button>
  );
}
