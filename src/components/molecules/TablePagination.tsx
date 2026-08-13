import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/components/design-system';

export interface TablePaginationProps {
  page: number;
  rowsPerPage: number;
  totalCount: number;
  rowsPerPageOptions?: number[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}

export function TablePagination({
  page,
  rowsPerPage,
  totalCount,
  rowsPerPageOptions = [5, 10, 25, 100],
  onPageChange,
  onRowsPerPageChange,
}: TablePaginationProps) {
  const { t } = useLanguage();
  const totalPages = Math.ceil(totalCount / rowsPerPage);
  const from = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const to = Math.min(page * rowsPerPage, totalCount);

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 'var(--space-4)',
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-600)',
    borderTop: '1px solid var(--color-neutral-100)',
  };

  const selectStyle: React.CSSProperties = {
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-neutral-0)',
    color: 'var(--color-neutral-700)',
    cursor: 'pointer',
    outline: 'none',
  };

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: disabled ? 'var(--color-neutral-300)' : 'var(--color-neutral-600)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'color var(--duration-fast) var(--easing-default)',
    padding: 0,
  });

  return (
    <div style={containerStyle}>
      <span>{t('pagination.rowsPerPage')}</span>
      <select
        style={selectStyle}
        value={rowsPerPage}
        onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
        aria-label={t('pagination.rowsPerPage')}
      >
        {rowsPerPageOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <span>
        {from}-{to} of {totalCount}
      </span>

      <button
        type="button"
        style={buttonStyle(!hasPrev)}
        disabled={!hasPrev}
        onClick={() => onPageChange(page - 1)}
        aria-label={t('general.previous')}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        style={buttonStyle(!hasNext)}
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
        aria-label={t('general.next')}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
