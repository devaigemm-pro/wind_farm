import { X } from 'lucide-react';
import { Skeleton } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import { CampaignAccordion } from './CampaignAccordion';
import type { Campaign } from '@/types';

export interface CampaignsPanelProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onViewResults: (campaignId: string) => void;
  onSubassetClick?: (subassetName: string) => void;
  onInspectionClick?: (inspectionId: string, status: string, campaignId: string | null, turbineId?: string | null, stage?: string) => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onDeleteCampaign?: (campaignId: string) => void;
  filterBySubasset?: string | null;
  onClearFilter?: () => void;
}

export function CampaignsPanel({
  campaigns, isLoading, onViewResults, onSubassetClick, onInspectionClick, onEditCampaign, onDeleteCampaign, filterBySubasset, onClearFilter,
}: CampaignsPanelProps) {
  const { t } = useLanguage();
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>{t('campaigns.title')}</h3>
      </div>
      {filterBySubasset && (
        <div style={filterBadgeStyle}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary-700)' }}>
            {t('campaigns.filteredBy')}: <strong>{filterBySubasset}</strong>
          </span>
          <button style={clearFilterBtnStyle} onClick={onClearFilter} title={t('campaigns.clearFilter')}>
            <X size={14} />
          </button>
        </div>
      )}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="48px" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <p style={emptyStyle}>{t('campaigns.noCampaigns')}</p>
      ) : (
        <div style={listStyle}>
          {campaigns.map((campaign) => (
            <CampaignAccordion
              key={campaign.id}
              campaign={campaign}
              onViewResults={onViewResults}
              onSubassetClick={onSubassetClick}
              onInspectionClick={onInspectionClick}
              onEdit={onEditCampaign}
              onDelete={onDeleteCampaign}
              filterBySubasset={filterBySubasset}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = { padding: 'var(--space-4)' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' };
const titleStyle: React.CSSProperties = { fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-neutral-900)', margin: 0 };
const emptyStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--color-neutral-500)' };
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' };
const filterBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-1) var(--space-3)',
  marginBottom: 'var(--space-3)',
  backgroundColor: 'var(--color-primary-50)',
  border: '1px solid var(--color-primary-200)',
  borderRadius: 'var(--radius-full, 9999px)',
};
const clearFilterBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-primary-600)',
  padding: '2px',
  borderRadius: '50%',
};
