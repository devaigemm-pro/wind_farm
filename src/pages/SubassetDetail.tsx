import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Download, Plus } from 'lucide-react';
import { TabBar } from '@/components/molecules/TabBar';
import { TablePagination } from '@/components/molecules/TablePagination';
import { DocumentDropbox } from '@/components/organisms/DocumentDropbox';
import { DefectsTable } from '@/components/organisms/DefectsTable';
import { DefectDetailPanel } from '@/components/organisms/DefectDetailPanel';
import { Badge } from '@/components/atoms';
import { Skeleton } from '@/components/atoms';
import { Button } from '@/components/atoms';
import { useTurbineDetail, useTurbineInspections, useTurbineDefects, useDefectImages } from '@/hooks/useWindFarmDetail';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import type { CampaignInspection, DefectSortField, DefectDashboardRow } from '@/types';

export function SubassetDetail() {
  const { windFarmId, turbineId } = useParams<{ windFarmId: string; turbineId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();

  const COLUMNS: { key: string; label: string }[] = [
    { key: 'inspectionDate', label: t('subassetDetail.colInspectionDate') },
    { key: 'subassetName', label: t('subassetDetail.colSubassetName') },
    { key: 'status', label: t('subassetDetail.colStatus') },
    { key: 'inspectionType', label: t('subassetDetail.colType') },
    { key: 'photosCount', label: t('subassetDetail.colPhotos') },
    { key: 'viewedPercent', label: t('subassetDetail.colViewed') },
    { key: 'defectsCount', label: t('subassetDetail.colDefects') },
    { key: 'notes', label: t('subassetDetail.colNotes') },
    { key: 'report', label: t('subassetDetail.colPdf') },
  ];

  const { data: detail, isLoading: detailLoading } = useTurbineDetail(turbineId);
  const { data: inspections, isLoading: inspectionsLoading } = useTurbineInspections(turbineId);
  const { data: defects, isLoading: defectsLoading } = useTurbineDefects(turbineId);

  // Load defect images in background (non-blocking)
  const defectIds = useMemo(() => (defects ?? []).map(d => d.id), [defects]);
  const { data: defectImageMap } = useDefectImages(defectIds);

  // Merge images into defects when available
  const defectsWithImages = useMemo(() => {
    if (!defects) return [];
    if (!defectImageMap) return defects;
    return defects.map(d => ({
      ...d,
      imageUrl: defectImageMap[d.id] ?? d.imageUrl,
    }));
  }, [defects, defectImageMap]);

  const [activeTab, setActiveTab] = useState('general');
  const [sortField, setSortField] = useState('inspectionDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Defects tab state
  const [defectSortField, setDefectSortField] = useState<DefectSortField>('rootDistance');
  const [defectSortDirection, setDefectSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);

  // Sort inspections
  const sortedInspections = useMemo(() => {
    if (!inspections) return [];
    return [...inspections].sort((a, b) => {
      const aVal = a[sortField as keyof CampaignInspection] ?? '';
      const bVal = b[sortField as keyof CampaignInspection] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [inspections, sortField, sortDirection]);

  const paginatedInspections = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedInspections.slice(start, start + rowsPerPage);
  }, [sortedInspections, page, rowsPerPage]);

  const handleSort = useCallback((field: string) => {
    if (field === 'report') return; // non-sortable
    if (field === sortField) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('desc'); }
    setPage(1);
  }, [sortField]);

  const handlePlanInspection = () => navigate(`/inspections/new?windFarm=${windFarmId}`);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  const getStatusBadge = (status: string, stage?: string) => {
    const s = stage || (status === 'completed' || status === 'approved' ? 'report' : 'planned');
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    const colorMap: Record<string, { bg: string; color: string }> = {
      report: { bg: '#DEF7EC', color: '#03543F' },
      analyze: { bg: '#FEF3C7', color: '#92400E' },
      annotate: { bg: '#EDE9FE', color: '#5B21B6' },
      inspect: { bg: '#DBEAFE', color: '#1E40AF' },
      planned: { bg: '#FEF9C3', color: '#854D0E' },
    };
    const colors = colorMap[s] || colorMap.planned!;
    return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.color }}>{label}</span>;
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div style={pageStyle}>
      {/* Breadcrumb toolbar */}
      <div style={toolbarStyle}>
        <div style={breadcrumbStyle}>
          <Link to={`/assets-wind/${windFarmId}`} style={bcLinkStyle}>
            {detail?.windFarmName ?? t('subassetDetail.windFarm')}
          </Link>
          <span style={bcSepStyle}>&gt;</span>
          <span style={bcCurrentStyle}>{detail?.name ?? t('general.loading')}</span>
        </div>
      </div>

      {/* Tabs */}
      <TabBar tabs={[
        { id: 'general', label: t('windFarmDetail.tabGeneral') },
        { id: 'defects', label: t('windFarmDetail.tabDefects') },
      ]} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && (
        <div style={contentStyle} className="wind-farm-detail-content">
          {/* Left column: Details + Documents */}
          <div style={leftColStyle} className="wind-farm-detail-left">
            {/* Details Card */}
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>{t('subassetDetail.details')}</h3>
              {detailLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} variant="rect" height="24px" />
                  ))}
                </div>
              ) : (
                <div style={detailsGridStyle}>
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>{t('subassetDetail.model')}</span>
                    <span style={detailValueStyle}>{detail?.model ?? '—'}</span>
                  </div>
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>{t('subassetDetail.latestInspection')}</span>
                    <span style={detailValueStyle}>{formatDate(detail?.latestInspection ?? null)}</span>
                  </div>
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>{t('subassetDetail.poweringDate')}</span>
                    <span style={detailValueStyle}>{formatDate(detail?.poweringDate ?? null)}</span>
                  </div>
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>{t('subassetDetail.power')}</span>
                    <span style={detailValueStyle}>{detail?.powerKw ? `${detail.powerKw} kW` : '—'}</span>
                  </div>
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>{t('subassetDetail.numberOfInspections')}</span>
                    <span style={detailValueStyle}>{detail?.inspectionsCount ?? 0}</span>
                  </div>
                </div>
              )}
              {role !== 'supervisor' && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={handlePlanInspection}
                  style={{ width: '100%', marginTop: 'var(--space-4)' }}
                >
                  {t('button.planInspection')}
                </Button>
              )}
            </div>

            {/* Documents Dropbox */}
            <DocumentDropbox windFarmId={windFarmId!} />
          </div>

          {/* Right column: Inspections table */}
          <div style={rightColStyle} className="wind-farm-detail-right">
            <div style={inspectionsPanelStyle}>
              <h3 style={cardTitleStyle}>{t('subassetDetail.inspections')}</h3>
              <div style={tableWrapperStyle} className="subasset-inspections-table">
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          style={thStyle}
                          onClick={() => handleSort(col.key)}
                        >
                          <span style={thContentStyle}>
                            {col.label} <SortIcon field={col.key} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inspectionsLoading
                      ? Array.from({ length: rowsPerPage }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan={COLUMNS.length} style={tdStyle}>
                              <Skeleton variant="rect" height="28px" />
                            </td>
                          </tr>
                        ))
                      : paginatedInspections.length === 0
                        ? (
                          <tr>
                            <td colSpan={COLUMNS.length} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-neutral-500)' }}>
                              {t('subassetDetail.noInspections')}
                            </td>
                          </tr>
                        )
                        : paginatedInspections.map((insp) => (
                          <tr
                            key={insp.id}
                            style={{ ...trStyle, cursor: 'pointer' }}
                            onClick={() => {
                              // Navigate based on inspection status/stage
                              if (insp.status === 'completed' || insp.status === 'approved') {
                                // Report → go to workflow step 4
                                navigate(`/inspections/${insp.id}/workflow?step=4`);
                              } else {
                                // In-progress → go to workflow at correct step
                                let step = 1;
                                if (insp.stage === 'annotate') step = 2;
                                else if (insp.stage === 'analyze') step = 3;
                                else if (insp.stage === 'report') step = 4;
                                navigate(`/inspections/${insp.id}/workflow?step=${step}`);
                              }
                            }}
                          >
                            <td style={tdStyle}>{formatDate(insp.inspectionDate)}</td>
                            <td style={tdStyle}>{insp.subassetName}</td>
                            <td style={tdStyle}>{getStatusBadge(insp.status, insp.stage)}</td>
                            <td style={tdStyle}>{insp.inspectionType}</td>
                            <td style={tdStyle}>{insp.photosCount}</td>
                            <td style={tdStyle}>{insp.viewedPercent} %</td>
                            <td style={tdStyle}>{insp.defectsCount}</td>
                            <td style={{ ...tdStyle, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {insp.notes ?? ''}
                            </td>
                            <td style={tdStyle}>
                              {(insp.status === 'completed' || insp.status === 'approved') && (
                                <button style={pdfBtnStyle} title={t('reports.downloadReport')} aria-label={t('reports.downloadReport')}>
                                  <Download size={16} color="var(--color-primary-500)" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={page}
                rowsPerPage={rowsPerPage}
                totalCount={sortedInspections.length}
                rowsPerPageOptions={[5, 10, 25, 100]}
                onPageChange={setPage}
                onRowsPerPageChange={(r) => { setRowsPerPage(r); setPage(1); }}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'defects' && (
        <div className="defects-split-container" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div className="defects-split-table" style={{ display: 'flex', flexDirection: 'column', flex: selectedDefectId ? '0 0 70%' : '1 1 100%', overflow: 'hidden', minHeight: 0 }}>
            <DefectsTable
              data={defectsWithImages}
              isLoading={defectsLoading}
              sortField={defectSortField}
              sortDirection={defectSortDirection}
              onSort={(field) => {
                if (field === defectSortField) {
                  setDefectSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                } else {
                  setDefectSortField(field);
                  setDefectSortDirection('asc');
                }
              }}
              selectedId={selectedDefectId}
              onSelect={setSelectedDefectId}
            />
          </div>
          {selectedDefectId && (() => {
            const selectedDefect = defectsWithImages.find((d: DefectDashboardRow) => d.id === selectedDefectId);
            return selectedDefect ? (
              <div className="defects-split-detail" style={{ flex: '0 0 30%', overflow: 'auto', minHeight: 0 }}>
                <DefectDetailPanel defect={selectedDefect} />
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const toolbarStyle: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const breadcrumbStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-base)',
};

const bcLinkStyle: React.CSSProperties = {
  color: 'var(--color-primary-600)',
  textDecoration: 'none',
  fontWeight: 500,
  cursor: 'pointer',
};

const bcSepStyle: React.CSSProperties = {
  color: 'var(--color-neutral-400)',
};

const bcCurrentStyle: React.CSSProperties = {
  color: 'var(--color-neutral-700)',
  fontWeight: 500,
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const leftColStyle: React.CSSProperties = {
  width: '35%',
  minWidth: '280px',
  overflowY: 'auto',
  borderRight: '1px solid var(--color-neutral-200)',
};

const rightColStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};

const cardStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--color-neutral-900)',
  margin: '0 0 var(--space-3) 0',
};

const detailsGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
};

const detailLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  color: 'var(--color-neutral-700)',
};

const detailValueStyle: React.CSSProperties = {
  color: 'var(--color-neutral-900)',
};

const inspectionsPanelStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
};

const tableWrapperStyle: React.CSSProperties = {
  overflowX: 'auto',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-xs)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 'var(--space-2) var(--space-3)',
  fontWeight: 600,
  color: 'var(--color-neutral-600)',
  borderBottom: '1px solid var(--color-neutral-200)',
  backgroundColor: 'var(--color-neutral-50)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const thContentStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
};

const tdStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--color-neutral-100)',
  whiteSpace: 'nowrap',
};

const trStyle: React.CSSProperties = {
  cursor: 'default',
};

const pdfBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'inline-flex',
  alignItems: 'center',
};
