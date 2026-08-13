import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, FileText, Wind, ExternalLink, ChevronDown, ChevronRight, Info, List, Columns3 } from 'lucide-react';
import { Skeleton } from '@/components/atoms';
import { useOngoingInspections } from '@/hooks/useOngoingInspections';
import { useLanguage } from '@/components/design-system';
import type { OngoingInspectionItem } from '@/services/ongoing.service';

// ─── Column Config ──────────────────────────────────────────────────────────

interface ColumnConfig {
  stage: string;
  title: string;
  actionIcon?: React.ReactNode;
  actionLabel?: string;
  actionRoute?: string;
}

const COLUMNS: ColumnConfig[] = [
  { stage: 'planned', title: 'ongoing.colPlanned', actionIcon: <Plus size={14} />, actionLabel: 'ongoing.actionNew' },
  { stage: 'inspect', title: 'ongoing.colUpload', actionIcon: <Upload size={14} />, actionLabel: 'ongoing.actionUpload' },
  { stage: 'annotate', title: 'ongoing.colAnnotate' },
  { stage: 'analyze', title: 'ongoing.colAnalyze' },
  { stage: 'report', title: 'ongoing.colReport', actionIcon: <FileText size={14} />, actionLabel: 'ongoing.actionReports', actionRoute: '/inspections/reports' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function OngoingInspections() {
  const navigate = useNavigate();
  const { data, isLoading } = useOngoingInspections();
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'status' | 'list'>('status');
  const [collapsedFarms, setCollapsedFarms] = useState<Set<string>>(new Set());

  // Auto-expand all farms when data loads (Skyvisor behavior: expanded by default)
  // We track collapsed instead of expanded, so by default everything is expanded.

  // Flatten for list view
  const listItems = useMemo(() => {
    if (!data) return [];
    const items: (OngoingInspectionItem & { windFarmName: string })[] = [];
    for (const groups of Object.values(data)) {
      for (const group of groups) {
        for (const item of group.items) {
          items.push({ ...item, windFarmName: group.windFarmName });
        }
      }
    }
    return items;
  }, [data]);

  const toggleFarm = (key: string) => {
    setCollapsedFarms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isFarmExpanded = (key: string) => !collapsedFarms.has(key);

  // Navigate to the correct page based on inspection stage
  const navigateToInspection = (item: OngoingInspectionItem) => {
    if (item.stage === 'report') {
      // Report stage → workflow step 4
      navigate(`/inspections/${item.id}/workflow?step=4`);
    } else {
      // Other stages → workflow
      navigate(`/inspections/${item.id}/workflow`);
    }
  };

  const handleColumnAction = (col: ColumnConfig) => {
    if (col.actionRoute) {
      navigate(col.actionRoute);
    } else if (col.stage === 'planned') {
      navigate('/inspections/new');
    } else if (col.stage === 'inspect') {
      navigate('/uploader');
    }
  };

  // Get summary for farm card header (like Skyvisor: "X% viewed")
  const getFarmSummary = (items: OngoingInspectionItem[]): string => {
    const viewedItems = items.filter((i) => i.viewed_percent != null && i.viewed_percent > 0);
    if (viewedItems.length === 0) return '';
    const avgViewed = viewedItems.reduce((sum, i) => sum + (i.viewed_percent ?? 0), 0) / viewedItems.length;
    return `${Math.round(avgViewed)}% ${t('ongoing.viewed')}`;
  };

  // Loading
  if (isLoading) {
    return (
      <div style={pageContainer}>
        <div style={toolbarStyle}>
          <Skeleton variant="text" width="200px" height="24px" />
          <Skeleton variant="rect" width="240px" height="32px" />
        </div>
        <div style={columnsContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={columnStyle}>
              <Skeleton variant="rect" width="100%" height="40px" />
              <Skeleton variant="rect" width="100%" height="120px" />
              <Skeleton variant="rect" width="100%" height="80px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      {/* ─── Toolbar ─────────────────────────────────────────────── */}
      <div style={toolbarStyle}>
        <h1 style={titleStyle}>{t('page.ongoingInspections')}</h1>

        <div style={toggleContainer}>
          <button
            style={viewMode === 'status' ? toggleBtnActive : toggleBtn}
            onClick={() => setViewMode('status')}
            title={t('ongoing.viewStatus')}
          >
            <Columns3 size={14} />
            <span>{t('ongoing.viewStatus')}</span>
          </button>
          <button
            style={viewMode === 'list' ? toggleBtnActive : toggleBtn}
            onClick={() => setViewMode('list')}
            title={t('ongoing.viewList')}
          >
            <List size={14} />
            <span>{t('ongoing.viewList')}</span>
          </button>
        </div>
      </div>

      {/* ─── Kanban View (by Stage) ──────────────────────────────── */}
      {viewMode === 'status' && (
        <div style={columnsContainer}>
          {COLUMNS.map((col) => {
            const groups = data?.[col.stage] ?? [];
            const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

            return (
              <div key={col.stage} style={columnStyle}>
                {/* Column Header */}
                <div style={columnHeader}>
                  <div style={columnHeaderLeft}>
                    <span style={columnTitle}>{t(col.title)}</span>
                    <span style={columnCount}>
                      {totalItems > 0 ? `${totalItems} ${totalItems === 1 ? t('general.item') : t('general.items')}` : ''}
                    </span>
                  </div>
                  {col.actionIcon && (
                    <button
                      style={columnActionBtn}
                      onClick={() => handleColumnAction(col)}
                      title={col.actionLabel ? t(col.actionLabel) : undefined}
                    >
                      {col.actionIcon}
                    </button>
                  )}
                </div>

                {/* Column Content */}
                <div style={columnContent}>
                  {groups.length === 0 ? (
                    <div style={emptyColumn} />
                  ) : (
                    groups.map((group) => {
                      const key = `${col.stage}-${group.windFarmId}`;
                      const isExpanded = isFarmExpanded(key);
                      const summaryText = getFarmSummary(group.items);

                      return (
                        <div key={key} style={farmCard}>
                          {/* Farm Header (accordion) — like Skyvisor */}
                          <div
                            style={farmHeader}
                            onClick={() => toggleFarm(key)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleFarm(key); }}
                          >
                            <div style={farmHeaderTop}>
                              <div style={farmTitleRow}>
                                <span style={farmName}>{group.windFarmName}</span>
                                <a
                                  href={`/assets-wind/${group.windFarmId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={farmLink}
                                  title={t('ongoing.goToWindFarm')}
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                              {summaryText && <div style={farmViewedText}>{summaryText}</div>}
                            </div>
                            <div style={farmHeaderMeta}>
                              <span style={farmItemCount}>{group.items.length} {group.items.length !== 1 ? t('general.items') : t('general.item')}</span>
                              {isExpanded
                                ? <ChevronDown size={16} color="#64748b" />
                                : <ChevronRight size={16} color="#64748b" />
                              }
                            </div>
                          </div>

                          {/* Expanded content — item rows */}
                          {isExpanded && (
                            <div style={farmContent}>
                              {group.items.map((item) => (
                                <div key={item.id} style={inspectionRow}>
                                  <div style={inspectionLeft}>
                                    <Wind size={16} color="#64748b" style={{ flexShrink: 0 }} />
                                    <span style={turbineName}>
                                      {item.turbine?.name ?? t('general.unknown')}
                                    </span>
                                  </div>
                                  <button
                                    style={infoBtn}
                                    onClick={() => navigateToInspection(item)}
                                    title={t('ongoing.inspectionDetails')}
                                  >
                                    <Info size={13} />
                                  </button>
                                  <span style={inspectionDate}>
                                    {item.scheduled_date
                                      ? new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
                                      : '—'}
                                  </span>
                                  <span style={inspectionStat}>
                                    {item.viewed_percent != null ? `${item.viewed_percent}%` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── List View ───────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div style={listContainer}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t('table.asset')}</th>
                <th style={thStyle}>{t('table.turbine')}</th>
                <th style={thStyle}>{t('table.stage')}</th>
                <th style={thStyle}>{t('table.date')}</th>
                <th style={thStyle}>{t('table.progress')}</th>
              </tr>
            </thead>
            <tbody>
              {listItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={emptyTd}>{t('ongoing.noFound')}</td>
                </tr>
              ) : (
                listItems.map((item) => (
                  <tr
                    key={item.id}
                    style={trStyle}
                    onClick={() => navigateToInspection(item)}
                  >
                    <td style={tdStyle}>{item.windFarmName}</td>
                    <td style={tdStyle}>{item.turbine?.name ?? '—'}</td>
                    <td style={tdStyle}>
                      <span style={stageBadgeStyle(item.stage)}>{item.stage}</span>
                    </td>
                    <td style={tdStyle}>
                      {item.scheduled_date
                        ? new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      {item.viewed_percent != null
                        ? `${item.viewed_percent}% ${t('ongoing.viewed')}`
                        : `${item.defects?.length ?? 0} ${t('turbineDetail.defects')}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stageBadgeStyle(stage: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    planned: { bg: 'rgba(99, 102, 241, 0.1)', fg: '#6366f1' },
    inspect: { bg: 'rgba(59, 130, 246, 0.1)', fg: '#1B4B7A' },
    annotate: { bg: 'rgba(245, 158, 11, 0.1)', fg: '#d97706' },
    analyze: { bg: 'rgba(16, 185, 129, 0.1)', fg: '#059669' },
    report: { bg: 'rgba(139, 92, 246, 0.1)', fg: '#7c3aed' },
  };
  const c = colors[stage] ?? { bg: 'rgba(148,163,184,0.1)', fg: '#64748b' };
  return {
    backgroundColor: c.bg,
    color: c.fg,
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
  };
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const pageContainer: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'var(--font-family-sans)',
  backgroundColor: 'var(--color-neutral-50, #f8fafc)',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--space-4, 1rem) var(--space-5, 1.25rem)',
  borderBottom: '1px solid var(--color-neutral-200, #e2e8f0)',
  backgroundColor: 'var(--color-neutral-0, #ffffff)',
  flexShrink: 0,
  gap: '16px',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-xl, 1.25rem)',
  fontWeight: 700,
  color: 'var(--color-neutral-900, #0f172a)',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.02em',
};

const toggleContainer: React.CSSProperties = {
  display: 'flex',
  gap: '2px',
  backgroundColor: 'var(--color-neutral-100, #f1f5f9)',
  borderRadius: 'var(--radius-md, 8px)',
  padding: '3px',
};

const toggleBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '5px 10px',
  border: 'none',
  borderRadius: 'var(--radius-sm, 6px)',
  background: 'transparent',
  color: 'var(--color-neutral-500, #64748b)',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-family-sans)',
};

const toggleBtnActive: React.CSSProperties = {
  ...toggleBtn,
  backgroundColor: 'var(--color-neutral-0, #ffffff)',
  color: 'var(--color-primary-500, #1B4B7A)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

// ─── Columns (Kanban) ───────────────────────────────────────────────────────

const columnsContainer: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  flex: 1,
  overflow: 'hidden',
  gap: '1px',
  backgroundColor: 'var(--color-neutral-200, #e2e8f0)',
};

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--color-neutral-50, #f8fafc)',
  overflow: 'hidden',
};

const columnHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  backgroundColor: 'var(--color-neutral-0, #ffffff)',
  borderBottom: '1px solid var(--color-neutral-200, #e2e8f0)',
  flexShrink: 0,
};

const columnHeaderLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const columnTitle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-neutral-800, #1e293b)',
};

const columnCount: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-neutral-500, #64748b)',
};

const columnActionBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px',
  border: 'none',
  borderRadius: '4px',
  background: 'transparent',
  color: 'var(--color-primary-500, #1B4B7A)',
  cursor: 'pointer',
};

const columnContent: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const emptyColumn: React.CSSProperties = {
  flex: 1,
};

// ─── Farm Cards (Accordion — Skyvisor style) ────────────────────────────────

const farmCard: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-0, #ffffff)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
  borderRadius: 'var(--radius-md, 8px)',
  overflow: 'hidden',
  boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)',
};

const farmHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '10px 12px',
  cursor: 'pointer',
  userSelect: 'none',
  gap: '8px',
};

const farmHeaderTop: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
  flex: 1,
};

const farmTitleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const farmName: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'var(--color-neutral-900, #0f172a)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const farmLink: React.CSSProperties = {
  color: 'var(--color-primary-500, #1B4B7A)',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
};

const farmViewedText: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-neutral-500, #64748b)',
  marginTop: '2px',
};

const farmHeaderMeta: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexShrink: 0,
};

const farmItemCount: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-neutral-500, #64748b)',
  whiteSpace: 'nowrap',
};

const farmContent: React.CSSProperties = {
  borderTop: '1px solid var(--color-neutral-200, #e2e8f0)',
  padding: '6px 10px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

// ─── Inspection Row (inside farm card) ──────────────────────────────────────

const inspectionRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '5fr auto 3fr 2fr',
  alignItems: 'center',
  gap: '4px',
  padding: '5px 4px',
  borderRadius: '4px',
};

const inspectionLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
};

const turbineName: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 500,
  color: 'var(--color-neutral-800, #1e293b)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const infoBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2px',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-neutral-400, #94a3b8)',
  cursor: 'pointer',
  flexShrink: 0,
};

const inspectionDate: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-neutral-700, #334155)',
  whiteSpace: 'nowrap',
  textAlign: 'center',
};

const inspectionStat: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-neutral-700, #334155)',
  whiteSpace: 'nowrap',
  textAlign: 'right',
};

// ─── List View ──────────────────────────────────────────────────────────────

const listContainer: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '12px 16px',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.8rem',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  color: 'var(--color-neutral-500, #64748b)',
  fontWeight: 500,
  fontSize: '0.72rem',
  borderBottom: '1px solid var(--color-neutral-200, #e2e8f0)',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  color: 'var(--color-neutral-800, #1e293b)',
  borderBottom: '1px solid var(--color-neutral-100, #f1f5f9)',
};

const trStyle: React.CSSProperties = {
  cursor: 'pointer',
};

const emptyTd: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  color: 'var(--color-neutral-400, #94a3b8)',
  padding: '32px 12px',
};
