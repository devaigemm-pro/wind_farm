import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-primary-500)',
    color: 'var(--color-neutral-0)',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-800)',
    border: '1px solid var(--color-neutral-200)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-800)',
    border: 'none',
  },
  danger: {
    backgroundColor: 'var(--color-danger-500)',
    color: 'var(--color-neutral-0)',
    border: 'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: 'var(--space-1) var(--space-3)',
    fontSize: 'var(--text-sm)',
    borderRadius: 'var(--radius-sm)',
    gap: 'var(--space-1)',
    height: '32px',
  },
  md: {
    padding: 'var(--space-2) var(--space-4)',
    fontSize: 'var(--text-sm)',
    borderRadius: 'var(--radius-md)',
    gap: 'var(--space-2)',
    height: '40px',
  },
  lg: {
    padding: 'var(--space-3) var(--space-6)',
    fontSize: 'var(--text-base)',
    borderRadius: 'var(--radius-md)',
    gap: 'var(--space-2)',
    height: '48px',
  },
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon: Icon,
      iconPosition = 'left',
      disabled,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-family-sans)',
      fontWeight: 500,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.5 : 1,
      transition: `all var(--duration-normal) var(--easing-default)`,
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      lineHeight: 1,
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...style,
    };

    const iconSize = iconSizes[size];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={baseStyle}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <Loader2
            size={iconSize}
            style={{
              animation: 'spin 1s linear infinite',
            }}
            aria-hidden="true"
          />
        )}
        {!loading && Icon && iconPosition === 'left' && (
          <Icon size={iconSize} aria-hidden="true" />
        )}
        {children}
        {!loading && Icon && iconPosition === 'right' && (
          <Icon size={iconSize} aria-hidden="true" />
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
