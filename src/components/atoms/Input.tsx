import { type InputHTMLAttributes, forwardRef, useId } from 'react';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: {
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--text-sm)',
    height: '32px',
  },
  md: {
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)',
    height: '40px',
  },
  lg: {
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--text-base)',
    height: '48px',
  },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, size = 'md', id, style, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
      width: '100%',
    };

    const labelStyle: React.CSSProperties = {
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      color: 'var(--color-neutral-800)',
      fontFamily: 'var(--font-family-sans)',
    };

    const inputStyle: React.CSSProperties = {
      width: '100%',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${error ? 'var(--color-danger-500)' : 'var(--color-neutral-200)'}`,
      backgroundColor: 'var(--color-neutral-0)',
      color: 'var(--color-neutral-900)',
      fontFamily: 'var(--font-family-sans)',
      outline: 'none',
      transition: `border-color var(--duration-normal) var(--easing-default), box-shadow var(--duration-normal) var(--easing-default)`,
      boxSizing: 'border-box',
      ...sizeStyles[size],
      ...style,
    };

    const messageStyle: React.CSSProperties = {
      fontSize: 'var(--text-xs)',
      fontFamily: 'var(--font-family-sans)',
      margin: 0,
    };

    return (
      <div style={containerStyle}>
        {label && (
          <label htmlFor={inputId} style={labelStyle}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={inputStyle}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" style={{ ...messageStyle, color: 'var(--color-danger-500)' }}>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} style={{ ...messageStyle, color: 'var(--color-neutral-500)' }}>
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
