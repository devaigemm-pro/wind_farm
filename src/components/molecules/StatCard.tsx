import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
  };
  iconColor?: string;
}

export function StatCard({
  icon: IconComponent,
  value,
  label,
  trend,
  iconColor = 'var(--color-primary-500)',
}: StatCardProps) {
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    padding: 'var(--space-5)',
    backgroundColor: 'var(--color-neutral-0)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-neutral-200)',
    boxShadow: 'var(--shadow-xs)',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const iconWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary-50)',
    color: iconColor,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 'var(--text-2xl)',
    fontWeight: 700,
    color: 'var(--color-neutral-900)',
    lineHeight: 1.2,
    margin: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-500)',
    margin: 0,
  };

  const trendStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color:
      trend?.direction === 'up'
        ? 'var(--color-success-500)'
        : 'var(--color-danger-500)',
  };

  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <div style={cardStyle} role="group" aria-label={`${label}: ${value}`}>
      <div style={headerStyle}>
        <div style={iconWrapperStyle}>
          <IconComponent size={20} aria-hidden="true" />
        </div>
        {trend && (
          <span style={trendStyle}>
            <TrendIcon size={14} aria-hidden="true" />
            {trend.percentage}%
          </span>
        )}
      </div>
      <div>
        <p style={valueStyle}>{value}</p>
        <p style={labelStyle}>{label}</p>
      </div>
    </div>
  );
}
