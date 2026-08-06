import { useRef, type CSSProperties } from 'react';
import { Calendar } from 'lucide-react';

export interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  required = false,
}: DatePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    width: '100%',
  };

  const labelStyle: CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: 'var(--color-neutral-600)',
    fontFamily: 'var(--font-family-sans)',
  };

  const inputContainerStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    paddingRight: '40px',
    border: `1px solid ${error ? 'var(--color-danger-500)' : 'var(--color-neutral-200)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-900)',
    backgroundColor: 'var(--color-neutral-0)',
    outline: 'none',
    boxSizing: 'border-box',
    height: '40px',
  };

  const iconButtonStyle: CSSProperties = {
    position: 'absolute',
    right: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    color: 'var(--color-neutral-500)',
  };

  const errorStyle: CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-danger-500)',
    fontFamily: 'var(--font-family-sans)',
    margin: 0,
  };

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: 'var(--color-danger-500)', marginLeft: '2px' }}>*</span>}
      </label>
      <div style={inputContainerStyle}>
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          aria-label={label}
          aria-invalid={!!error}
          required={required}
        />
        <button
          type="button"
          style={iconButtonStyle}
          onClick={() => inputRef.current?.showPicker?.()}
          aria-label="Open calendar"
          tabIndex={-1}
        >
          <Calendar size={16} />
        </button>
      </div>
      {error && <p style={errorStyle} role="alert">{error}</p>}
    </div>
  );
}
