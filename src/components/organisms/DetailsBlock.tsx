import { Plus } from 'lucide-react';
import { Button, Skeleton } from '@/components/atoms';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import type { WindFarmDetail } from '@/types';

export interface DetailsBlockProps {
  detail: WindFarmDetail | undefined;
  isLoading: boolean;
  onPlanInspection: () => void;
}

export function DetailsBlock({ detail, isLoading, onPlanInspection }: DetailsBlockProps) {
  const { role } = useAuth();
  const { t, locale } = useLanguage();
  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US');
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <h3 style={titleStyle}>{t('details.title')}</h3>
        <div style={gridStyle}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="40px" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>{t('details.title')}</h3>
      <div style={gridStyle}>
        <div style={metricStyle}>
          <span style={labelStyle}>{t('details.oldestInspection')}</span>
          <span style={valueStyle}>{formatDate(detail?.oldestInspection ?? null)}</span>
        </div>
        <div style={metricStyle}>
          <span style={labelStyle}>{t('details.totalPower')}</span>
          <span style={valueStyle}>{detail?.totalPower?.toLocaleString() ?? 0} kW</span>
        </div>
        <div style={metricStyle}>
          <span style={labelStyle}>{t('details.poweringDate')}</span>
          <span style={valueStyle}>{formatDate(detail?.poweringDate ?? null)}</span>
        </div>
        <div style={metricStyle}>
          <span style={labelStyle}>{t('details.numberOfSubassets')}</span>
          <span style={valueStyle}>{detail?.subAssetsCount ?? 0}</span>
        </div>
      </div>
      {role !== 'supervisor' && (
        <Button variant="primary" icon={Plus} onClick={onPlanInspection} style={{ width: '100%', marginTop: 'var(--space-4)' }}>
          {t('details.planInspection')}
        </Button>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--color-neutral-900)',
  margin: '0 0 var(--space-3) 0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-3)',
};

const metricStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-neutral-500)',
  fontWeight: 500,
};

const valueStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--color-neutral-900)',
  fontWeight: 700,
};
