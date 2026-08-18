import { Skeleton } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import type { WindFarmDashboardRow } from '@/types';

export type WindFarmSortField =
  | 'name'
  | 'subAssetsCount'
  | 'inspectionsCount'
  | 'totalPower'
  | 'poweringDate'
  | 'oldestInspection';

export interface WindFarmsTableProps {
  data: WindFarmDashboardRow[];
  isLoading: boolean;
  sortField: WindFarmSortField;
  sortDirection: 'asc' | 'desc';
  onSort: (field: WindFarmSortField) => void;
  onRowClick?: (id: string) => void;
  skeletonRows?: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPower(power: number): string {
  return power.toLocaleString('en-US');
}

export function WindFarmsTable({
  data,
  isLoading,
  sortField,
  sortDirection,
  onSort,
  onRowClick,
  skeletonRows = 5,
}: WindFarmsTableProps) {
  const { t } = useLanguage();
  
  const COLS: { field: WindFarmSortField; label: string }[] = [
    { field: 'name', label: t('windFarmsTable.assetName') },
    { field: 'subAssetsCount', label: t('windFarmsTable.subAssetsCount') },
    { field: 'inspectionsCount', label: t('windFarmsTable.inspections') },
    { field: 'totalPower', label: t('windFarmsTable.totalPower') },
    { field: 'poweringDate', label: t('windFarmsTable.poweringDate') },
    { field: 'oldestInspection', label: t('windFarmsTable.oldestInspection') },
  ];
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: 'var(--space-3) var(--space-4)',
    fontWeight: 600,
    fontSize: 'var(--text-xs)',
    color: 'var(--color-neutral-600)',
    backgroundColor: 'var(--color-neutral-50)',
    borderBottom: '2px solid var(--color-neutral-200)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const thStyleLeft: React.CSSProperties = { ...thStyle, textAlign: 'left' };

  const tdStyle: React.CSSProperties = {
    padding: 'var(--space-3) var(--space-4)',
    color: 'var(--color-neutral-800)',
    borderBottom: '1px solid #E5E7EB',
    textAlign: 'center',
  };

  const tdStyleLeft: React.CSSProperties = { ...tdStyle, textAlign: 'left' };

  const rowStyle: React.CSSProperties = {
    transition: 'background-color var(--duration-fast) var(--easing-default)',
  };

  const sortIndicator = (field: WindFarmSortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} variant="rect" height="48px" />
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }} className="responsive-table-wrapper">
      <table style={tableStyle}>
        <thead>
          <tr>
            {COLS.map((col) => (
              <th
                key={col.field}
                style={col.field === 'name' ? thStyleLeft : thStyle}
                onClick={() => onSort(col.field)}
                aria-sort={
                  sortField === col.field
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                {col.label}{sortIndicator(col.field)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.id}
              style={{ ...rowStyle, cursor: onRowClick ? 'pointer' : 'default' }}
              onClick={() => onRowClick?.(row.id)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-neutral-50)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '';
              }}
            >
              <td style={{ ...tdStyleLeft, color: 'var(--color-primary-500)', fontWeight: 500 }}>{row.name}</td>
              <td style={tdStyle}>{row.subAssetsCount}</td>
              <td style={tdStyle}>{row.inspectionsCount}</td>
              <td style={tdStyle}>{formatPower(row.totalPower)}</td>
              <td style={tdStyle}>{formatDate(row.poweringDate)}</td>
              <td style={tdStyle}>{formatDate(row.oldestInspection)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
