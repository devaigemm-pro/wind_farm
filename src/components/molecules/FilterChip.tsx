import { X } from 'lucide-react';

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
}

export function FilterChip({
  label,
  selected = false,
  onRemove,
  onClick,
}: FilterChipProps) {
  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    padding: 'var(--space-1) var(--space-3)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    fontWeight: 500,
    borderRadius: 'var(--radius-full)',
    border: `1px solid ${selected ? 'var(--color-primary-500)' : 'var(--color-neutral-200)'}`,
    backgroundColor: selected
      ? 'var(--color-primary-50)'
      : 'var(--color-neutral-0)',
    color: selected
      ? 'var(--color-primary-700)'
      : 'var(--color-neutral-800)',
    cursor: onClick ? 'pointer' : 'default',
    transition: `all var(--duration-normal) var(--easing-default)`,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const removeButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    borderRadius: 'var(--radius-full)',
    opacity: 0.7,
    transition: `opacity var(--duration-fast) var(--easing-default)`,
  };

  return (
    <span
      style={chipStyle}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-pressed={onClick ? selected : undefined}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={removeButtonStyle}
          aria-label={`Remove ${label} filter`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
