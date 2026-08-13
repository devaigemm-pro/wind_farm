import type { CSSProperties } from 'react';

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  disabled?: boolean;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  name,
  disabled = false,
}: SegmentedControlProps) {
  const containerStyle: CSSProperties = {
    display: 'inline-flex',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '1px solid var(--color-neutral-200)',
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  };

  const getOptionStyle = (isActive: boolean): CSSProperties => ({
    padding: 'var(--space-2) var(--space-4)',
    border: 'none',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--text-sm)',
    fontWeight: isActive ? 600 : 400,
    backgroundColor: isActive ? '#5A8F5A' : 'var(--color-neutral-50)',
    color: isActive ? '#FFFFFF' : 'var(--color-neutral-700)',
    transition: 'background-color 150ms ease, color 150ms ease',
    minWidth: '80px',
    textAlign: 'center' as const,
  });

  return (
    <div style={containerStyle} role="radiogroup" aria-label={name}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            style={getOptionStyle(isActive)}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            onMouseEnter={(e) => {
              if (!isActive && !disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-neutral-100)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive && !disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-neutral-50)';
              }
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
