import type { CSSProperties } from 'react';
import { Wind } from 'lucide-react';
import { Skeleton } from '@/components/atoms';
import type { SubassetSelectionRow } from '@/types';

export interface SubassetsSelectionPanelProps {
  data: SubassetSelectionRow[];
  isLoading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function SubassetsSelectionPanel({
  data,
  isLoading,
  selectedIds,
  onSelectionChange,
}: SubassetsSelectionPanelProps) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < data.length;

  const handleMasterToggle = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((d) => d.id));
    }
  };

  const handleRowToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
  };

  const thStyle: CSSProperties = {
    padding: 'var(--space-2) var(--space-3)',
    textAlign: 'left',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--color-neutral-600)',
    borderBottom: '1px solid #E5E7EB',
    whiteSpace: 'nowrap',
  };

  const tdStyle: CSSProperties = {
    padding: 'var(--space-2) var(--space-3)',
    borderBottom: '1px solid #E5E7EB',
    color: 'var(--color-neutral-800)',
    verticalAlign: 'middle',
  };

  const rowStyle: CSSProperties = {
    cursor: 'pointer',
    transition: 'background-color 100ms ease',
  };

  const checkboxStyle = (checked: boolean): CSSProperties => ({
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: checked ? 'none' : '2px solid var(--color-neutral-300)',
    backgroundColor: checked ? '#00A3E0' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  });

  const headerLabelStyle: CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--color-neutral-500)',
    padding: 'var(--space-2) var(--space-3)',
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={headerLabelStyle}>Subassets</div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ marginBottom: '4px' }}>
            <Skeleton variant="rect" height="44px" width="100%" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerLabelStyle}>Subassets</div>
        <div style={{ padding: 'var(--space-4)', color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No hay turbinas disponibles para este parque.
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '40px' }}>
              <div
                style={checkboxStyle(allSelected)}
                onClick={handleMasterToggle}
                role="checkbox"
                aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
                aria-label="Select all turbines"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMasterToggle(); } }}
              >
                {(allSelected || someSelected) && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    {allSelected ? (
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M3 6H9" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    )}
                  </svg>
                )}
              </div>
            </th>
            <th style={{ ...thStyle, width: '30px' }}></th>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Model</th>
            <th style={thStyle}>Last inspection</th>
            <th style={thStyle}>Last defects detected</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const isSelected = selectedIds.includes(row.id);
            return (
              <tr
                key={row.id}
                style={{ ...rowStyle, backgroundColor: isSelected ? 'rgba(0, 163, 224, 0.04)' : undefined }}
                onClick={() => handleRowToggle(row.id)}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-neutral-50)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? 'rgba(0, 163, 224, 0.04)' : ''; }}
              >
                <td style={tdStyle}>
                  <div style={checkboxStyle(isSelected)}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </td>
                <td style={tdStyle}>
                  <Wind size={16} color="var(--color-neutral-500)" />
                </td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{row.name}</td>
                <td style={tdStyle}>{row.model ?? '—'}</td>
                <td style={tdStyle}>{row.lastInspectionDate ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{row.lastDefectsCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
