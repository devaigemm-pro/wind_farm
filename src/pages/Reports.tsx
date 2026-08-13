import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronUp, ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { EmptyState } from '@/components/molecules';
import { useAuth } from '@/hooks/useAuth';
import { useFinalizedInspections } from '@/hooks/useReports';
import { useLanguage } from '@/components/design-system';
import { getPdfBlob, downloadBlob } from '@/utils/pdfStorage';
import { supabase } from '@/lib/supabase';
import type { InspectionReportRow, ReportSortField } from '@/types';

type SortDir = 'asc' | 'desc';

export function Reports() {
  const { role } = useAuth();
  const { data: rows, isLoading } = useFinalizedInspections();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // State
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<ReportSortField>('inspectionDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter
  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.asset.toLowerCase().includes(q) ||
        r.subAsset.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        (r.note && r.note.toLowerCase().includes(q)) ||
        r.inspectionDate.includes(q),
    );
  }, [rows, search]);

  // Sort
  const sorted = useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'inspectionDate':
          cmp = a.inspectionDate.localeCompare(b.inspectionDate);
          break;
        case 'asset':
          cmp = a.asset.localeCompare(b.asset);
          break;
        case 'subAsset':
          cmp = a.subAsset.localeCompare(b.subAsset);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'defectsCount':
          cmp = a.defectsCount - b.defectsCount;
          break;
        case 'note':
          cmp = (a.note || '').localeCompare(b.note || '');
          break;
        case 'pdfReport':
          cmp = (a.pdfStoragePath ? 1 : 0) - (b.pdfStoragePath ? 1 : 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [filtered, sortField, sortDir]);

  // Paginate
  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  const totalPages = Math.ceil(sorted.length / rowsPerPage);

  // Handlers
  const handleSort = (field: ReportSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  const handleRowClick = (row: InspectionReportRow) => {
    navigate(`/inspections/${row.id}/workflow?step=4`);
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (e: React.MouseEvent, row: InspectionReportRow) => {
    e.stopPropagation();
    setDownloadingId(row.id);
    try {
      const blob = await getPdfBlob(row.id);
      if (blob) {
        const filename = `Inspection_${row.asset}_${row.subAsset}.pdf`;
        downloadBlob(blob, filename.replace(/\s+/g, '_'));
      } else {
        alert('No se encontró el PDF generado. Por favor genera el reporte desde la vista de Resultados (Step 4).');
      }
    } catch {
      alert('Error al descargar el reporte.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRemove = async (e: React.MouseEvent, row: InspectionReportRow) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar este reporte de la lista?')) return;
    try {
      await (supabase as any).from('inspection')
        .update({ stage: 'annotate', completed_at: null })
        .eq('id', row.id);
      // Refresh the list
      window.location.reload();
    } catch {
      alert('Error al eliminar.');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  // Column definitions
  const columns: { field: ReportSortField; label: string; width?: string }[] = [
    { field: 'inspectionDate', label: t('reports.colInspectionDate'), width: '130px' },
    { field: 'asset', label: t('reports.colAsset') },
    { field: 'subAsset', label: t('reports.colSubAsset'), width: '100px' },
    { field: 'type', label: t('reports.colType'), width: '90px' },
    { field: 'defectsCount', label: t('reports.colDefects'), width: '80px' },
    { field: 'note', label: t('reports.colNote') },
    { field: 'pdfReport', label: t('reports.colPdf'), width: '130px' },
  ];

  // Render sort indicator
  const SortIcon = ({ field }: { field: ReportSortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp size={12} style={{ marginLeft: 4 }} />
    ) : (
      <ChevronDown size={12} style={{ marginLeft: 4 }} />
    );
  };

  if (isLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.toolbar}>
          <h5 style={styles.title}>{t('page.reports')}</h5>
        </div>
        <div style={styles.content}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="52px" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <h5 style={styles.title}>{t('page.reports')}</h5>
        <div style={styles.searchContainer}>
          <Search size={16} style={{ color: 'var(--color-neutral-400)' }} />
          <input
            type="text"
            placeholder={t('reports.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            style={styles.searchInput}
            aria-label={t('reports.searchReports')}
          />
        </div>
        <div style={{ width: '100px' }} />
      </div>

      {/* Table */}
      <div style={styles.content}>
        {sorted.length === 0 ? (
          <EmptyState
            title={t('reports.noFinalized')}
            description={t('reports.noFinalizedDesc')}
          />
        ) : (
          <>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.field}
                        style={{ ...styles.th, width: col.width }}
                        onClick={() => handleSort(col.field)}
                        role="columnheader"
                        aria-sort={
                          sortField === col.field
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        <span style={styles.thContent}>
                          {col.label}
                          <SortIcon field={col.field} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => (
                    <tr
                      key={row.id}
                      style={styles.row}
                      onClick={() => handleRowClick(row)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          'rgba(76, 175, 80, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={styles.td}>{formatDate(row.inspectionDate)}</td>
                      <td style={styles.td}>{row.asset}</td>
                      <td style={styles.td}>{row.subAsset}</td>
                      <td style={styles.td}>{row.type}</td>
                      <td style={styles.td}>{row.defectsCount}</td>
                      <td style={styles.td}>{row.note || ''}</td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            style={styles.downloadIcon}
                            onClick={(e) => handleDownload(e, row)}
                            disabled={downloadingId === row.id}
                            aria-label={row.pdfStoragePath ? 'Download report' : 'Generate and download report'}
                          >
                            {downloadingId === row.id ? (
                              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#4CAF50' }} />
                            ) : (
                              <Download size={18} color="#4CAF50" />
                            )}
                          </button>
                          {role !== 'supervisor' && (
                          <button
                            style={styles.downloadIcon}
                            onClick={(e) => handleRemove(e, row)}
                            aria-label="Remove from reports"
                          >
                            <Trash2 size={16} color="#999" />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={styles.pagination}>
              <span style={styles.rowsPerPageLabel}>{t('reports.rowsPerPage')}</span>
              <div style={styles.rowsPerPage}>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  style={styles.select}
                  aria-label={t('pagination.rowsPerPage')}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div style={styles.pageInfo}>
                {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, sorted.length)} {t('general.of')}{' '}
                {sorted.length}
              </div>
              <button
                style={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label={t('general.previous')}
              >
                ‹
              </button>
              <button
                style={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                aria-label={t('general.next')}
              >
                ›
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'Calibri, "Gill Sans", Arial, sans-serif',
    backgroundColor: 'var(--color-neutral-50)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-neutral-0)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '16.8px',
    fontWeight: 400,
    color: '#000',
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-neutral-0)',
    minWidth: '250px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    fontFamily: 'inherit',
    flex: 1,
    color: 'var(--color-neutral-800)',
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '0',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'var(--color-neutral-0)',
  },
  th: {
    textAlign: 'left',
    padding: '14px 16px',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--color-neutral-800)',
    backgroundColor: 'var(--color-neutral-100)',
    borderBottom: '1px solid var(--color-neutral-200)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  thContent: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  row: {
    cursor: 'pointer',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    height: '65px',
    transition: 'background-color 0.15s',
  },
  td: {
    padding: '16px',
    fontSize: '12px',
    color: 'var(--color-neutral-800)',
    whiteSpace: 'nowrap',
  },
  downloadIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '10px 16px',
    borderTop: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-neutral-0)',
    fontSize: '12px',
    color: 'var(--color-neutral-500)',
  },
  rowsPerPageLabel: {
    fontSize: '12px',
    color: 'var(--color-neutral-500)',
    padding: '4px 8px',
    border: '1px solid #4CAF50',
    borderRadius: '4px',
    backgroundColor: 'transparent',
  },
  rowsPerPage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  select: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: '4px',
    fontFamily: 'inherit',
    backgroundColor: 'var(--color-neutral-0)',
    color: 'var(--color-neutral-500)',
  },
  pageInfo: {
    fontSize: '12px',
    color: 'var(--color-neutral-500)',
  },
  pageBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: '4px',
    backgroundColor: 'var(--color-neutral-0)',
    cursor: 'pointer',
    fontSize: '16px',
    color: 'var(--color-neutral-500)',
  },
};
