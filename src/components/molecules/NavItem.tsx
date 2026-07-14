import type { LucideIcon } from 'lucide-react';
import { Tooltip } from '@/components/atoms';

export interface NavItemProps {
  icon: LucideIcon;
  label: string;
  badge?: number;
  isActive?: boolean;
  isCollapsed?: boolean;
  onClick?: () => void;
}

export function NavItem({
  icon: IconComponent,
  label,
  badge,
  isActive = false,
  isCollapsed = false,
  onClick,
}: NavItemProps) {
  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: isCollapsed
      ? 'var(--space-2)'
      : 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    backgroundColor: isActive
      ? 'var(--color-primary-50)'
      : 'transparent',
    color: isActive
      ? 'var(--color-primary-700)'
      : 'var(--color-neutral-500)',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
    fontWeight: isActive ? 500 : 400,
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: `all var(--duration-normal) var(--easing-default)`,
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    position: 'relative',
  };

  const labelStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 var(--space-1)',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    borderRadius: 'var(--radius-full)',
    backgroundColor: isActive
      ? 'var(--color-primary-500)'
      : 'var(--color-neutral-200)',
    color: isActive
      ? 'var(--color-neutral-0)'
      : 'var(--color-neutral-800)',
  };

  const content = (
    <button
      type="button"
      style={itemStyle}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={isCollapsed ? label : undefined}
      title={isCollapsed ? undefined : undefined}
    >
      <IconComponent
        size={20}
        aria-hidden="true"
      />
      {!isCollapsed && (
        <>
          <span style={labelStyle}>{label}</span>
          {badge !== undefined && badge > 0 && (
            <span style={badgeStyle} aria-label={`${badge} items`}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip content={label} placement="right">
        {content}
      </Tooltip>
    );
  }

  return content;
}
