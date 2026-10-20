import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Skeleton } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';
import { CampaignAccordion } from './CampaignAccordion';
import { NewCleaningCampaignModal } from './NewCleaningCampaignModal';
import type { Campaign } from '@/types';

export interface CampaignsPanelProps {
  campaigns: Campaign[];
  isLoading: boolean;
  /** Wind farm the panel belongs to — needed to create a cleaning campaign. */
  windFarmId?: string;
  onViewResults: (campaignId: string) => void;
  onSubassetClick?: (subassetName: string) => void;
  onInspectionClick?: (inspectionId: string, status: string, campaignId: string | null, turbineId?: string | null, stage?: string) => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onDeleteCampaign?: (campaignId: string) => void;
  /** Whether the user can create a cleaning campaign (hidden for read-only roles). */
  canCreate?: boolean;
  filterBySubasset?: string | null;
  onClearFilter?: () => void;
}

export function CampaignsPanel({
  campaigns, isLoading, windFarmId, onViewResults, onSubassetClick, onInspectionClick, onEditCampaign, onDeleteCampaign, canCreate = true, filterBySubasset, onClearFilter,
}: CampaignsPanelProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'inspection' | 'repair' | 'cleaning'>('inspection');
  const [showNewCleaning, setShowNewCleaning] = useState(false);

  const inspectionCampaigns = useMemo(
    () => campaigns.filter((c) => (c.type ?? 'inspection') === 'inspection'),
    [campaigns],
  );
  const repairCampaigns = useMemo(
    () => campaigns.filter((c) => c.type === 'repair'),
    [campaigns],
  );
  const cleaningCampaigns = useMemo(
    () => campaigns.filter((c) => c.type === 'cleaning'),
    [campaigns],
  );
  const visibleCampaigns =
    activeTab === 'repair'
      ? repairCampaigns
      : activeTab === 'cleaning'
        ? cleaningCampaigns
        : inspectionCampaigns;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>{t('campaigns.title')}</h3>
      </div>
      {/* Tabs: Inspections vs Repairs */}
      <div style={tabsStyle}>
        <button
          style={activeTab === 'inspection' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('inspection')}
        >
          {t('campaign.typeInspection')} ({inspectionCampaigns.length})
        </button>
        <button
          style={activeTab === 'repair' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('repair')}
        >
          {t('campaign.typeRepair')} ({repairCampaigns.length})
        </button>
        <button
          style={activeTab === 'cleaning' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('cleaning')}
        >
          {t('campaign.typeCleaning')} ({cleaningCampaigns.length})
        </button>
      </div>

      {/* Create a new cleaning campaign (selector modal) — only on the
          Limpieza tab, for users who can create campaigns. */}
      {activeTab === 'cleaning' && canCreate && windFarmId && (
        <div style={createBarStyle}>
          <button style={createBtnStyle} onClick={() => setShowNewCleaning(true)}>
            <Plus size={14} /> {t('cleaning.newCampaign')}
          </button>
        </div>
      )}
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
      ) : visibleCampaigns.length === 0 ? (
        <p style={emptyStyle}>{t('campaigns.noCampaigns')}</p>
      ) : (
        <div style={listStyle}>
          {visibleCampaigns.map((campaign) => (
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

      {/* New cleaning campaign selector modal */}
      {windFarmId && showNewCleaning && (
        <NewCleaningCampaignModal
          windFarmId={windFarmId}
          isOpen
          onClose={() => setShowNewCleaning(false)}
        />
      )}
    </div>
  );
}

const createBarStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)',
};
const createBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
  background: '#5A8F5A', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
};
const containerStyle: React.CSSProperties = { padding: 'var(--space-4)' };
const tabsStyle: React.CSSProperties = { display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-neutral-200)' };
const tabStyle: React.CSSProperties = {
  padding: '8px 16px', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
  background: 'none', border: 'none', borderBottom: '2px solid transparent',
  color: 'var(--color-neutral-500)', fontFamily: 'var(--font-family-sans)',
};
const activeTabStyle: React.CSSProperties = {
  ...tabStyle, color: '#5A8F5A', borderBottom: '2px solid #5A8F5A',
};
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
