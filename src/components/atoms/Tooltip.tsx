import { type ReactNode, useState, useRef, useCallback } from 'react';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  placement?: TooltipPlacement;
  delay?: number;
  children: ReactNode;
}

const placementStyles: Record<TooltipPlacement, React.CSSProperties> = {
  top: {
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: 'var(--space-2)',
  },
  bottom: {
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 'var(--space-2)',
  },
  left: {
    right: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginRight: 'var(--space-2)',
  },
  right: {
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginLeft: 'var(--space-2)',
  },
};

export function Tooltip({
  content,
  placement = 'top',
  delay = 200,
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
  };

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    padding: 'var(--space-1) var(--space-2)',
    backgroundColor: 'var(--color-neutral-900)',
    color: 'var(--color-neutral-0)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-family-sans)',
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: `opacity var(--duration-normal) var(--easing-default)`,
    boxShadow: 'var(--shadow-md)',
    ...placementStyles[placement],
  };

  return (
    <div
      style={containerStyle}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <div role="tooltip" aria-hidden={!visible} style={tooltipStyle}>
        {content}
      </div>
    </div>
  );
}
