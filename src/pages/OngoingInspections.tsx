import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Upload, FileText, Wind, ExternalLink, ChevronDown, ChevronRight, Info, List, Columns3 } from 'lucide-react';
import { Skeleton } from '@/components/atoms';
import { useOngoingInspections } from '@/hooks/useOngoingInspections';
import type { OngoingGroupedByFarm, OngoingInspectionItem } from '@/services/ongoing.service';

// ─── Column Config ──────────────────────────────────────────────────────────

interface ColumnConfig {
  stage: string;
  title: string;
  actionIcon?: React.ReactNode;
  actionLabel?: string;
  actionRoute?: string;
}

const COLUMNS: ColumnConfig[] = [
  { stage: 'planned', title: 'Planned', actionIcon: <Plus size={14} />, actionLabel: 'New' },
  { stage: 'uploaded', title: 'Upload', actionIcon: <Upload size={14} />, actionLabel: 'Upload' },
  { stage: 'annotated', title: 'Annotate' },
  { stage: 'analyzed', title: 'Analyze', actionIcon: <FileText size={14} />, actionLabel: 'Reports', actionRoute: '/inspections/reports' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function OngoingInspections() {
  const navigate = useNavigate();
  const { data, isLoading } = useOngoingInspections();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'status' | 'list'>('status');
  const [expandedFarms, setExpandedFarms] = useState<Set<string>>(new Set());

  // Filter data by search
  const filteredData = useMemo(() => {
    if (!data) return null;
    if (!searchTerm.trim()) return data;

    const term = searchTerm.toLowerCase();
    const result: Record<string, OngoingGroupedByFarm[]> = {};

    for (const [stage, groups] of Object.entries(data)) {
      const filteredGroups: OngoingGroupedByFarm[] = [];
      for (const group of groups) {
        const filteredItems = group.items.filter(
          (item) =>
            item.turbine?.name.toLowerCase().includes(term) ||
            group.windFarmName.toLowerCase().includes(term),
        );
        if (filteredItems.length > 0) {
          filteredGroups.push({ ...group, items: filteredItems });
        }
      }
      result[stage] = filteredGroups;
    }
    return result;
  }, [data, searchTerm]);

  // Flatten for list view
  const listItems = useMemo(() => {
    if (!filteredData) return [];
    const items: (OngoingInspectionItem & { windFarmName: string })[] = [];
    for (const groups of Object.values(filteredData)) {
      for (const group of groups) {
        for (const item of group.items) {
          items.push({ ...item, windFarmName: group.windFarmName });
        }
      }
    }
    return items;
  }, [filteredData]);

  const toggleFarm = (key: string) => {
    setExpandedFarms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleColumnAction = (col: ColumnConfig) => {
    if (col.actionRoute) {
      navigate(col.actionRoute);
    } else if (col.stage === 'planned') {
      navigate('/inspections/new');
    } else if (col.stage === 'uploaded') {
      navigate('/inspections/upload');
    }
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
          {[1, 2, 3, 4].map((i) => (
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
        <h1 style={titleStyle}>Ongoing Inspections</h1>

        <div style={searchContainer}>
          <Search size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by turbine or wind farm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={searchInput}
          />
        </div>

        <div style={toggleContainer}>
          <button
            style={viewMode === 'status' ? toggleBtnActive : toggleBtn}
            onClick={() => setViewMode('status')}
            title="Kanban view"
          >
            <Columns3 size={14} />
            <span>Status</span>
          </button>
          <button
            style={viewMode === 'list' ? toggleBtnActive : toggleBtn}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List size={14} />
            <span>List</span>
          </button>
        </div>
      </div>

      {/* ─── Kanban View ─────────────────────────────────────────── */}
      {viewMode === 'status' && (
        <div style={columnsContainer}>
          {COLUMNS.map((col) => {
            const groups = filteredData?.[col.stage] ?? [];
            const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

            return (
              <div key={col.stage} style={columnStyle}>
                {/* Column Header */}
                <div style={columnHeader}>
                  <div style={columnHeaderLeft}>
                    <span style={columnTitle}>{col.title}</span>
                    <span style={columnCount}>{totalItems}</span>
                  </div>
                  {col.actionIcon && (
                    <button
                      style={columnActionBtn}
                      onClick={() => handleColumnAction(col)}
                      title={col.actionLabel}
                    >
                      {col.actionIcon}
                      {col.actionLabel && <span style={columnActionLabel}>{col.actionLabel}</span>}
                    </button>
                  )}
                </div>

                {/* Column Content */}
                <div style={columnContent}>
                  {groups.length === 0 ? (
                    <div style={emptyColumn}>
                      <span style={emptyText}>No inspections</span>
                    </div>
                  ) : (
                    groups.map((group) => {
                      const key = `${col.stage}-${group.windFarmId}`;
                      const isExpanded = expandedFarms.has(key);
                      const summaryText = getSummaryText(col.stage, group.items);

                      return (
                        <div key={key} style={farmCard}>
                          {/* Farm Header (accordion) */}
                          <div
                            style={farmHeader}
                            onClick={() => toggleFarm(key)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleFarm(key); }}
                          >
                            <div style={farmHeaderLeft}>
                              {isExpanded ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
                              <span style={farmName}>{group.windFarmName}</span>
                              <a
                                href={`/assets-wind/${group.windFarmId}`}
                                onClick={(e) => e.stopPropagation()}
                                style={farmLink}
                                title="Go to wind farm"
                              >
                                <ExternalLink size={12} />
                              </a>
                            </div>
                            <div style={farmHeaderRight}>
                              <span style={farmSummary}>{summaryText}</span>
                              <span style={farmItemCount}>{group.items.length} items</span>
                            </div>
                          </div>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div style={farmContent}>
                              {group.items.map((item) => (
                                <div key={item.id} style={turbineRow}>
                                  <Wind size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                                  <span style={turbineName}>
                                    {item.turbine?.name ?? 'Unknown'}
                                  </span>
                                  <button
                                    style={infoBtn}
                                    onClick={() => navigate(`/inspections/${item.id}`)}
                                    title="Inspection details"
                                  >
                                    <Info size={12} />
                                  </button>
                                  <span style={turbineDate}>
                                    {item.scheduled_date
                                      ? new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                      : '—'}
                                  </span>
                                  <span style={turbineStat}>
                                    {getItemStat(col.stage, item)}
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
                <th style={thStyle}>Asset</th>
                <th style={thStyle}>Turbine</th>
                <th style={thStyle}>Stage</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {listItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={emptyTd}>No ongoing inspections found</td>
                </tr>
              ) : (
                listItems.map((item) => (
                  <tr
                    key={item.id}
                    style={trStyle}
                    onClick={() => navigate(`/inspections/${item.id}`)}
                  >
                    <td style={tdStyle}>{item.windFarmName}</td>
                    <td style={tdStyle}>{item.turbine?.name ?? '—'}</td>
                    <td style={tdStyle}>
                      <span style={stageBadge(item.stage)}>{item.stage}</span>
                    </td>
                    <td style={tdStyle}>
                      {item.scheduled_date
                        ? new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      {item.viewed_percent != null
                        ? `${item.viewed_percent}% viewed`
                        : `${item.defects?.length ?? 0} defects`}
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

function getSummaryText(stage: string, items: OngoingInspectionItem[]): string {
  if (stage === 'planned') return '';
  if (stage === 'uploaded' || stage === 'annotated') {
    const totalViewed = items.reduce((s, i) => s + (i.viewed_percent ?? 0), 0);
    const avg = items.length > 0 ? Math.round(totalViewed / items.length) : 0;
    return `${avg}% viewed`;
  }
  if (stage === 'analyzed') {
    const totalDefects = items.reduce((s, i) => s + (i.defects?.length ?? 0), 0);
    return `${totalDefects} defect${totalDefects !== 1 ? 's' : ''}`;
  }
  return '';
}

function getItemStat(stage: string, item: OngoingInspectionItem): string {
  if (stage === 'uploaded' || stage === 'annotated') {
    return `${item.viewed_percent ?? 0}%`;
  }
  if (stage === 'analyzed') {
    return `${item.defects?.length ?? 0} def.`;
  }
  return '';
}

function stageBadge(stage: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    planned: { bg: 'rgba(99, 102, 241, 0.1)', fg: '#6366f1' },
    uploaded: { bg: 'rgba(59, 130, 246, 0.1)', fg: '#1B4B7A' },
    annotated: { bg: 'rgba(245, 158, 11, 0.1)', fg: '#d97706' },
    analyzed: { bg: 'rgba(16, 185, 129, 0.1)', fg: '#059669' },
  };
  const c = colors[stage] ?? { bg: 'rgba(148,163,184,0.1)', fg: '#64748b' };
  return {
    backgroundColor: c.bg,
    color: c.fg,
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'capitalize',
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

const searchContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  backgroundColor: 'var(--color-neutral-0, #ffffff)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
  borderRadius: 'var(--radius-lg, 12px)',
  padding: '6px 12px',
  flex: 1,
  maxWidth: '320px',
};

const searchInput: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--color-neutral-800, #1e293b)',
  fontSize: 'var(--text-sm, 0.875rem)',
  width: '100%',
  fontFamily: 'var(--font-family-sans)',
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
  gridTemplateColumns: 'repeat(4, 1fr)',
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
  backgroundColor: 'var(--color-neutral-100, #f1f5f9)',
  padding: '1px 6px',
  borderRadius: '9999px',
};

const columnActionBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  border: '1px solid var(--color-primary-200, #bfdbfe)',
  borderRadius: 'var(--radius-sm, 6px)',
  background: 'transparent',
  color: 'var(--color-primary-500, #1B4B7A)',
  fontSize: '0.7rem',
  cursor: 'pointer',
  fontFamily: 'var(--font-family-sans)',
};

const columnActionLabel: React.CSSProperties = {
  fontSize: '0.7rem',
};

const columnContent: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const emptyColumn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 12px',
};

const emptyText: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-neutral-400, #94a3b8)',
};

// ─── Farm Cards (Accordion) ─────────────────────────────────────────────────

const farmCard: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-0, #ffffff)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
  borderRadius: 'var(--radius-md, 8px)',
  overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

const farmHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
  cursor: 'pointer',
  userSelect: 'none',
};

const farmHeaderLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
};

const farmName: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--color-neutral-800, #1e293b)',
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

const farmHeaderRight: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: 0,
};

const farmSummary: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--color-neutral-500, #64748b)',
};

const farmItemCount: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--color-neutral-500, #64748b)',
  backgroundColor: 'var(--color-neutral-100, #f1f5f9)',
  padding: '1px 5px',
  borderRadius: '9999px',
};

const farmContent: React.CSSProperties = {
  borderTop: '1px solid var(--color-neutral-100, #f1f5f9)',
  padding: '4px 8px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const turbineRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 6px',
  borderRadius: '4px',
  backgroundColor: 'var(--color-neutral-50, #f8fafc)',
};

const turbineName: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 500,
  color: 'var(--color-neutral-800, #1e293b)',
  flex: 1,
  minWidth: 0,
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

const turbineDate: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--color-neutral-500, #64748b)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const turbineStat: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--color-primary-500, #1B4B7A)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  minWidth: '36px',
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
