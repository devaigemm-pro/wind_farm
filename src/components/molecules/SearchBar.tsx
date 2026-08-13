import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useLanguage } from '@/components/design-system';

export interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  defaultValue?: string;
}

export function SearchBar({
  onSearch,
  placeholder,
  debounceMs = 300,
  defaultValue = '',
}: SearchBarProps) {
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t('search.placeholder');
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const debouncedSearch = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(query);
      }, debounceMs);
    },
    [onSearch, debounceMs],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedSearch(newValue);
  };

  const handleClear = () => {
    setValue('');
    onSearch('');
    inputRef.current?.focus();
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: 'var(--space-3)',
    color: 'var(--color-neutral-400)',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '40px',
    paddingLeft: 'var(--space-10)',
    paddingRight: value ? 'var(--space-10)' : 'var(--space-3)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-900)',
    backgroundColor: 'var(--color-neutral-0)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: `border-color var(--duration-normal) var(--easing-default), box-shadow var(--duration-normal) var(--easing-default)`,
    boxSizing: 'border-box',
  };

  const clearButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: 'var(--space-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-neutral-400)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    padding: 0,
    transition: `color var(--duration-normal) var(--easing-default)`,
  };

  return (
    <div style={containerStyle}>
      <span style={iconStyle} aria-hidden="true">
        <Search size={16} />
      </span>
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={value}
        onChange={handleChange}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
        style={inputStyle}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          style={clearButtonStyle}
          aria-label={t('search.clear')}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
