import type { ReactNode } from 'react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useLanguage } from '@/components/design-system';

export interface ChartCardProps {
  title: string;
  children: ReactNode;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  filterSlot?: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  children,
  isLoading,
  isError,
  isEmpty,
  filterSlot,
  className = '',
}: ChartCardProps) {
  const { t } = useLanguage();
  return (
    <div className={`chart-card ${className}`}>
      <div className="chart-card__header">
        <h3 className="chart-card__title">{title}</h3>
        {filterSlot && <div className="chart-card__filters">{filterSlot}</div>}
      </div>

      <div className="chart-card__body">
        {isLoading ? (
          <div style={{ width: '100%' }}>
            <Skeleton variant="rect" height="200px" />
          </div>
        ) : isError ? (
          <p className="chart-card__error">{t('chart.failed')}</p>
        ) : isEmpty ? (
          <p className="chart-card__empty">{t('chart.noData')}</p>
        ) : (
          <div style={{ width: '100%', height: '100%' }}>{children}</div>
        )}
      </div>
    </div>
  );
}
