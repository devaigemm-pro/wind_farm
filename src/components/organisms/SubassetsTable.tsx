import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button, Skeleton } from '@/components/atoms';
import { TablePagination } from '@/components/molecules/TablePagination';
import type { TurbineSubassetRow } from '@/types';

export interface SubassetsTableProps {
  data: TurbineSubassetRow[];
  isLoading: boolean;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  page: number;
  rowsPerPage: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  onOpenSerialNumbers: () => void;
  onRowClick?: (turbineId: string) => void;
  selectedSubassetName?: string | null;
}

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'model', label: 'Model' },
  { key: 'lastInspection', label: 'Last Inspection' },
  { key: 'poweringDate', label: 'Powering Date' },
  { key: 'inspectionsCount', label: '# Inspections' },
];

export function SubassetsTable({
  data, isLoading, sortField, sortDirection, onSort,
  page, rowsPerPage, totalCount, onPageChange, onRowsPerPageChange,
  onOpenSerialNumbers, onRowClick, selectedSubassetName,
}: SubassetsTableProps) {
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>Subassets</h3>
      <div style={tableWrapperStyle} className="responsive-table-wrapper">
        <table style={tableStyle}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} style={thStyle} onClick={() => onSort(col.key)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    {col.label} <SortIcon field={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: rowsPerPage }).map((_, i) => (
                  <tr key={i}><td colSpan={5} style={tdStyle}><Skeleton variant="rect" height="32px" /></td></tr>
                ))
              : data.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      ...trStyle,
                      backgroundColor: selectedSubassetName === row.name ? 'var(--color-primary-50)' : undefined,
                      borderLeft: selectedSubassetName === row.name ? '3px solid var(--color-primary-500)' : '3px solid transparent',
                    }}
                    onClick={() => onRowClick?.(row.id)}
                  >
                    <td style={tdStyle}>{row.name}</td>
                    <td style={tdStyle}>{row.model ?? '—'}</td>
                    <td style={tdStyle}>{formatDate(row.lastInspection)}</td>
                    <td style={tdStyle}>{formatDate(row.poweringDate)}</td>
                    <td style={tdStyle}>{row.inspectionsCount}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page}
        rowsPerPage={rowsPerPage}
        totalCount={totalCount}
        rowsPerPageOptions={[5, 10, 25, 100]}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
      />
      <div style={{ padding: 'var(--space-3) 0' }}>
        <Button variant="secondary" size="sm" onClick={onOpenSerialNumbers}>
          Turbines Serial Numbers
        </Button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = { padding: 'var(--space-4)', borderBottom: '1px solid var(--color-neutral-200)' };
const titleStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-neutral-900)', margin: '0 0 var(--space-3) 0' };
const tableWrapperStyle: React.CSSProperties = { overflowX: 'auto' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 600, color: 'var(--color-neutral-600)', borderBottom: '1px solid var(--color-neutral-200)', backgroundColor: 'var(--color-neutral-50)' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-neutral-100)' };
const trStyle: React.CSSProperties = { cursor: 'pointer' };
