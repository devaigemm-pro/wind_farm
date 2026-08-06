import type { CSSProperties } from 'react';

export interface NotificationToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function NotificationToggle({
  checked,
  onChange,
  label = 'Subscribe to email notifications for new inspections',
}: NotificationToggleProps) {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const trackStyle: CSSProperties = {
    position: 'relative',
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    backgroundColor: checked ? '#4CAF50' : '#CCC',
    transition: 'background-color 200ms ease',
    flexShrink: 0,
  };

  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: checked ? '22px' : '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'left 200ms ease',
  };

  const labelStyle: CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-700)',
    fontFamily: 'var(--font-family-sans)',
    lineHeight: 1.4,
  };

  const dotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: checked ? '#4CAF50' : 'transparent',
    flexShrink: 0,
  };

  return (
    <div
      style={containerStyle}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div style={dotStyle} aria-hidden="true" />
      <div style={trackStyle}>
        <div style={thumbStyle} />
      </div>
      <span style={labelStyle}>{label}</span>
    </div>
  );
}
