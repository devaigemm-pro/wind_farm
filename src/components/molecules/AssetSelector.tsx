import type { CSSProperties } from 'react';
import { useLanguage } from '@/components/design-system';

export interface AssetSelectorProps {
  windFarms: { id: string; name: string }[];
  value: string | null;
  onChange: (windFarmId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function AssetSelector({
  windFarms,
  value,
  onChange,
  isLoading = false,
  disabled = false,
}: AssetSelectorProps) {
  const { t } = useLanguage();
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

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-neutral-900)',
    backgroundColor: 'var(--color-neutral-0)',
    height: '40px',
    outline: 'none',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    boxSizing: 'border-box',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '36px',
  };

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>Asset</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
        disabled={disabled || isLoading}
        aria-label={t('misc.selectWindFarm')}
      >
        {isLoading ? (
          <option value="">{t('general.loading')}</option>
        ) : (
          <>
            <option value="" disabled>
              Seleccionar parque...
            </option>
            {windFarms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
