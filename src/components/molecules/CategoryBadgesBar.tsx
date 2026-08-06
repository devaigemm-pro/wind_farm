export interface CategoryBadgesBarProps {
  defectsByCat: Record<number, number>;
  resolvedCount: number;
  totalDefects: number;
}

const CAT_COLORS: Record<number, string> = {
  5: '#E53E3E',
  4: '#FF5500',
  3: '#FFA500',
  2: '#006A4E',
  1: '#68D391',
};

export function CategoryBadgesBar({ defectsByCat, resolvedCount, totalDefects }: CategoryBadgesBarProps) {
  return (
    <div style={containerStyle}>
      {/* Severity boxes */}
      <div style={badgesRowStyle}>
        {[5, 4, 3, 2, 1].map((cat) => (
          <div key={cat} style={badgeBoxStyle}>
            <span style={countStyle}>{defectsByCat[cat] ?? 0}</span>
            <div style={{ ...colorBarStyle, backgroundColor: CAT_COLORS[cat] }} />
            <span style={labelStyle}>Cat {cat}</span>
          </div>
        ))}
      </div>

      {/* Info alert card */}
      <div style={alertCardStyle}>
        <span style={alertTextStyle}>{resolvedCount} resolved</span>
        <div style={separatorStyle} />
        <span style={alertTextStyle}>{totalDefects} defects</span>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '12px 0',
};

const badgesRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
};

const badgeBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  padding: '8px 12px',
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 'var(--radius-sm)',
  minWidth: '50px',
};

const countStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1.1rem',
  color: 'var(--color-neutral-900)',
};

const colorBarStyle: React.CSSProperties = {
  width: '100%',
  height: '4px',
  borderRadius: '2px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--color-neutral-500)',
};

const alertCardStyle: React.CSSProperties = {
  backgroundColor: '#0288D1',
  borderRadius: 'var(--radius-md)',
  padding: '12px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  marginLeft: 'auto',
};

const separatorStyle: React.CSSProperties = {
  width: '100%',
  height: '1px',
  backgroundColor: 'rgba(255,255,255,0.3)',
};

const alertTextStyle: React.CSSProperties = {
  color: 'white',
  fontSize: '0.8rem',
  fontWeight: 600,
};
