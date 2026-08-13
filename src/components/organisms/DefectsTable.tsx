import { Skeleton } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import type { DefectDashboardRow, DefectSortField } from '@/types';

export interface DefectsTableProps {
  data: DefectDashboardRow[];
  isLoading: boolean;
  sortField: DefectSortField;
  sortDirection: 'asc' | 'desc';
  onSort: (field: DefectSortField) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleResolved?: (id: string, resolved: boolean) => void;
  skeletonRows?: number;
}

function getCategoryBadgeStyle(category: number): React.CSSProperties {
  let bgColor = '#F2994A'; // default orange for cat 3
  if (category >= 5) bgColor = '#DC2626';
  else if (category >= 4) bgColor = '#E06300';
  else if (category === 2) bgColor = '#6B7280';
  else if (category <= 1) bgColor = '#22C55E';

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: bgColor,
    color: '#FFFFFF',
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: 'var(--font-family-sans)',
  };
}

function getActionBadge(actionText: string, urgency: string): React.CSSProperties {
  // Matching the reference: orange/red badges with white text
  let bgColor = '#E88B00'; // default orange
  if (urgency === 'high') bgColor = '#D35400';
  else if (urgency === 'low') bgColor = '#27AE60';

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: bgColor,
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: 600,
    fontFamily: 'var(--font-family-sans)',
    lineHeight: '1rem',
    maxWidth: '100%',
  };
}

// Wrench SVG icon matching the reference
function WrenchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 19 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M17.7302 4.047L14.0074 7.76987L11.3719 5.1344L15.0935 1.41283C14.0515 0.915164 12.8809 0.752384 11.7426 0.94686C10.6043 1.14134 9.55416 1.68353 8.73646 2.49893C8.04405 3.19289 7.54629 4.05672 7.2931 5.00377C7.0399 5.95082 7.04018 6.9478 7.29391 7.8947L0.830066 14.3585C-0.26497 15.4536 -0.26497 17.2167 0.830066 18.3117C1.9251 19.4068 3.68823 19.4068 4.78326 18.3117L11.2484 11.8466C12.195 12.1002 13.1917 12.1006 14.1384 11.8476C15.0852 11.5947 15.9489 11.0973 16.6429 10.4053C17.4588 9.58769 18.0014 8.53738 18.1961 7.39881C18.3908 6.26025 18.2281 5.08931 17.7302 4.047Z" fill="white" />
    </svg>
  );
}

// Wrench with strikethrough (no action required)
function WrenchCrossedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M20.2332 3.71048L16.5103 7.43335L13.8749 4.79788L17.5964 1.07632C16.5544 0.578646 15.3838 0.415867 14.2455 0.610343C13.1072 0.804819 12.0571 1.34701 11.2394 2.16242C10.547 2.85637 10.0492 3.7202 9.79603 4.66725C9.54283 5.6143 9.54311 6.61128 9.79684 7.55819L3.333 14.022C2.23796 15.1171 2.23796 16.8802 3.333 17.9752C4.42803 19.0702 6.19116 19.0702 7.28619 17.9752L13.7513 11.5101C14.6979 11.7637 15.6946 11.7641 16.6414 11.5111C17.5882 11.2582 18.4518 10.7608 19.1458 10.0688C19.9617 9.25117 20.5043 8.20086 20.699 7.0623C20.8937 5.92373 20.731 4.7528 20.2332 3.71048Z" fill="white" />
      <line x1="1.33229" y1="1.68499" x2="20.4892" y2="20.3964" stroke="white" strokeWidth="3" />
    </svg>
  );
}

// Filter icon for column headers
function FilterIcon() {
  return (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="10" width="10" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5, marginLeft: '4px' }}>
      <path fill="none" d="M0 0h24v24H0z" />
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
    </svg>
  );
}

export function DefectsTable({
  data,
  isLoading,
  sortField,
  sortDirection,
  onSort,
  selectedId,
  onSelect,
  onToggleResolved,
  skeletonRows = 10,
}: DefectsTableProps) {
  const { t } = useLanguage();
  
  const COLS: { field: DefectSortField; label: string; width?: string; sortable: boolean }[] = [
    { field: 'assetName', label: t('defectsTable.asset'), width: '10%', sortable: true },
    { field: 'turbineName', label: t('defectsTable.turbine'), width: '7%', sortable: true },
    { field: 'turbineModel', label: t('defectsTable.model'), width: '9%', sortable: true },
    { field: 'type', label: t('defectsTable.type'), width: '11%', sortable: true },
    { field: 'defectSize', label: t('defectsTable.defectSize'), width: '9%', sortable: false },
    { field: 'category', label: t('defectsTable.category'), width: '7%', sortable: true },
    { field: 'action', label: t('defectsTable.action'), width: '13%', sortable: false },
    { field: 'nextStep', label: t('defectsTable.nextStep'), width: '12%', sortable: true },
    { field: 'blade', label: t('defectsTable.blade'), width: '5%', sortable: true },
    { field: 'side', label: t('defectsTable.side'), width: '5%', sortable: true },
    { field: 'rootDistance', label: t('defectsTable.rootDistance'), width: '13%', sortable: true },
    { field: 'resolved', label: t('defectsTable.resolved'), width: '10%', sortable: true },
  ];
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-xs)',
    tableLayout: 'fixed',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 8px',
    fontWeight: 600,
    fontSize: '10px',
    color: '#4B5563',
    backgroundColor: '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const tdStyle: React.CSSProperties = {
    padding: '8px',
    color: '#1F2937',
    borderBottom: '1px solid #E5E7EB',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '11px',
  };

  const sortIndicator = (field: string) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', backgroundColor: '#FFFFFF' }}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} variant="rect" height="36px" />
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, backgroundColor: '#FFFFFF' }} className="responsive-table-wrapper">
      <table style={tableStyle}>
        <thead>
          <tr>
            {COLS.map((col) => (
              <th
                key={col.field}
                style={{ ...thStyle, width: col.width, cursor: col.sortable ? 'pointer' : 'default' }}
                onClick={() => {
                  if (col.sortable && (col.field as string) !== 'comments') {
                    onSort(col.field as DefectSortField);
                  }
                }}
                aria-sort={
                  col.sortable && sortField === col.field
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {col.label}{sortIndicator(col.field)}
                  {col.sortable && <FilterIcon />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const isSelected = row.id === selectedId;
            const rowBg = isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent';
            return (
              <tr
                key={row.id}
                style={{ backgroundColor: rowBg, cursor: 'pointer', transition: 'background-color 0.15s' }}
                onClick={() => onSelect(row.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <td style={{ ...tdStyle, paddingLeft: '12px' }}>{row.assetName}</td>
                <td style={tdStyle}>{row.turbineName}</td>
                <td style={tdStyle}>{row.turbineModel}</td>
                <td style={tdStyle}>{row.type}</td>
                <td style={tdStyle}>{(row.defectWidth || row.defectHeight) ? `${row.defectWidth} x ${row.defectHeight}` : '—'}</td>
                <td style={tdStyle}>
                  <span style={getCategoryBadgeStyle(row.category)}>{row.category}</span>
                </td>
                <td style={{ ...tdStyle, overflow: 'visible', whiteSpace: 'normal' }}>
                  <span style={getActionBadge(row.actionText, row.actionUrgency)}>
                    {row.actionUrgency === 'low' ? <WrenchCrossedIcon /> : <WrenchIcon />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1rem' }}>{row.actionText}</span>
                  </span>
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'normal', lineHeight: '0.9rem', maxWidth: '10rem' }}>{row.nextStep}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{row.bladePosition}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{row.side}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{row.rootDistance}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  {row.resolved ? (
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#27AE60' }} />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
