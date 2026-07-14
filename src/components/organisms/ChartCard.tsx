import type { ReactNode } from 'react';
import { Skeleton } from '@/components/atoms/Skeleton';

export interface ChartCardProps {
  title: string;
  children: ReactNode;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  filterSlot?: ReactNode;
}

export function ChartCard({
  title,
  children,
  isLoading,
  isError,
  isEmpty,
  filterSlot,
}: ChartCardProps) {
  return (
    <div
      style={{
        border: '1px solid var(--color-neutral-200)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-4)',
        backgroundColor: 'var(--color-white, #fff)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-3)',
        minHeight: '320px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-2)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--font-size-md, 1rem)',
            fontWeight: 600,
          }}
        >
          {title}
        </h3>
        {filterSlot && <div>{filterSlot}</div>}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isLoading ? (
          <div style={{ width: '100%' }}>
            <Skeleton variant="rect" height="200px" />
          </div>
        ) : isError ? (
          <p style={{ color: 'var(--color-error-500, #ef4444)', margin: 0 }}>
            Failed to load chart data.
          </p>
        ) : isEmpty ? (
          <p style={{ color: 'var(--color-neutral-500, #6b7280)', margin: 0 }}>
            No data available.
          </p>
        ) : (
          <div style={{ width: '100%', height: '100%' }}>{children}</div>
        )}
      </div>
    </div>
  );
}
