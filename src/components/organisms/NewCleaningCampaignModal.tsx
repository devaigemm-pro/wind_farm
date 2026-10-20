import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/design-system';
import { useSubassets, useCreateCleaningCampaign } from '@/hooks/useWindFarmDetail';
import { useToast } from '@/store/toastStore';

export interface NewCleaningCampaignModalProps {
  windFarmId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Selector form to create a CLEANING ("Limpieza de Turbina") campaign.
 *
 * Mirrors the inspection creation path (createCampaign) but adds a TURBINE
 * selector: a cleaning campaign is always scoped to one turbine. The turbine
 * list comes from the wind farm's subassets (useSubassets). On submit it
 * inserts a `campaign` with type='cleaning' / status='cleaning_open' and
 * navigates straight to the cleaning workflow for the new campaign.
 */
export function NewCleaningCampaignModal({ windFarmId, isOpen, onClose }: NewCleaningCampaignModalProps) {
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: turbines, isLoading } = useSubassets(isOpen ? windFarmId : undefined);
  const createCleaning = useCreateCleaningCampaign();

  const [turbineId, setTurbineId] = useState('');
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const selectedTurbine = turbines?.find((tr) => tr.id === turbineId);

  const handleSave = async () => {
    if (!turbineId) {
      toast.error(t('cleaning.selectTurbineRequired'));
      return;
    }
    // Default the campaign name to the turbine name when left blank.
    const finalName = name.trim() || `${t('campaign.typeCleaning')} · ${selectedTurbine?.name ?? ''}`.trim();
    try {
      const campaign = await createCleaning.mutateAsync({
        windFarmId,
        turbineId,
        name: finalName,
      });
      toast.success(t('cleaning.createSuccess'));
      onClose();
      navigate(`/cleaning/${campaign.id}`);
    } catch {
      toast.error(t('cleaning.createError'));
    }
  };

  const isSaving = createCleaning.isPending;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>{t('cleaning.newCampaign')}</h2>

        {/* Turbine selector */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={labelStyle}>{t('cleaning.turbine')} *</label>
          <select
            style={inputStyle}
            value={turbineId}
            onChange={(e) => setTurbineId(e.target.value)}
            disabled={isLoading || isSaving}
          >
            <option value="">
              {isLoading ? t('general.loading') : t('cleaning.selectTurbine')}
            </option>
            {(turbines ?? []).map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
                {tr.model ? ` · ${tr.model}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Campaign name (optional) */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={labelStyle}>{t('cleaning.campaignName')}</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('cleaning.campaignNamePlaceholder')}
            maxLength={40}
            disabled={isSaving}
          />
          <span style={charCountStyle}>{name.length}/40</span>
        </div>

        {/* Footer buttons */}
        <div style={footerStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={isSaving}>
            {t('button.cancel')}
          </button>
          <button style={saveBtnStyle} onClick={handleSave} disabled={!turbineId || isSaving}>
            {isSaving ? t('campaigns.saving') : t('button.create')}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-0)', borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)', width: '90%', maxWidth: '480px',
  display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)',
};
const modalTitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-lg)', fontWeight: 700, color: '#5A8F5A', margin: '0 0 var(--space-4) 0',
};
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-neutral-700)',
  display: 'block', marginBottom: '4px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--color-neutral-300)', borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)', boxSizing: 'border-box', background: '#fff',
};
const charCountStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)', color: 'var(--color-neutral-400)', marginTop: '2px',
  display: 'block', textAlign: 'right',
};
const footerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)',
  marginTop: 'var(--space-2)', paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--color-neutral-200)',
};
const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)', backgroundColor: '#e0e0e0', color: '#333B46',
  border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
  fontWeight: 500, cursor: 'pointer',
};
const saveBtnStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)', backgroundColor: '#5A8F5A', color: '#ffffff',
  border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
  fontWeight: 500, cursor: 'pointer',
};
