import type { ReactNode } from 'react';

export type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  info: {
    backgroundColor: 'var(--color-primary-50)',
    color: 'var(--color-primary-700)',
  },
  success: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  warning: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  danger: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  neutral: {
    backgroundColor: 'var(--color-neutral-100)',
    color: 'var(--color-neutral-800)',
  },
};

const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
  sm: {
    padding: '2px var(--space-2)',
    fontSize: 'var(--text-xs)',
  },
  md: {
    padding: 'var(--space-1) var(--space-3)',
    fontSize: 'var(--text-sm)',
  },
};

export function Badge({ variant = 'neutral', size = 'sm', children }: BadgeProps) {
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-full)',
    fontWeight: 500,
    fontFamily: 'var(--font-family-sans)',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  return <span style={style}>{children}</span>;
}
