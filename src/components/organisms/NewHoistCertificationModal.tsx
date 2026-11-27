import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/design-system';
import { useSubassets, useCreateHoistCertificationCampaign } from '@/hooks/useWindFarmDetail';
import { useAddHoistTurbines } from '@/hooks/useHoistCertification';
import { useToast } from '@/store/toastStore';

export interface NewHoistCertificationModalProps {
  windFarmId: string;
  isOpen: boolean;
  onClose: () => void;
  /**
   * When set, the modal ADDS turbines to this existing parent campaign instead
   * of creating a new one (no name field; turbines already in it are disabled).
   */
  groupId?: string;
  existingTurbineIds?: string[];
}

/**
 * Selector form for a HOIST-CERTIFICATION ("Certificación de polipastos")
 * campaign that holds many turbines. The turbine list comes from the wind
 * farm's subassets (useSubassets). Create mode inserts a parent campaign plus
 * one turbine campaign per selected turbine and opens the parent campaign; add
 * mode adds the selected turbines to an existing parent campaign.
 */
export function NewHoistCertificationModal({
  windFarmId,
  isOpen,
  onClose,
  groupId,
  existingTurbineIds = [],
}: NewHoistCertificationModalProps) {
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: turbines, isLoading } = useSubassets(isOpen ? windFarmId : undefined);
  const createHoist = useCreateHoistCertificationCampaign();
  const addTurbines = useAddHoistTurbines(groupId);
  const isAdd = !!groupId;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const existing = new Set(existingTurbineIds);
  const available = (turbines ?? []).filter((tr) => !existing.has(tr.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSave = async () => {
    if (selected.size === 0) {
      toast.error(t('hoist.selectTurbinesRequired'));
      return;
    }
    const turbineIds = [...selected];
    if (isAdd) {
      try {
        await addTurbines.mutateAsync(turbineIds);
        toast.success(t('hoist.addTurbinesSuccess'));
        onClose();
      } catch {
        toast.error(t('hoist.addTurbinesError'));
      }
      return;
    }
    const now = new Date();
    const dateLabel = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const finalName = name.trim() || `${t('campaign.typeHoistCertification')} · ${dateLabel}`;
    try {
      const campaign = await createHoist.mutateAsync({ windFarmId, turbineIds, name: finalName });
      toast.success(t('hoist.createSuccess'));
      onClose();
      navigate(`/hoist-certification/campaign/${campaign.id}`);
    } catch {
      toast.error(t('hoist.createError'));
    }
  };

  const isSaving = createHoist.isPending || addTurbines.isPending;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>{isAdd ? t('hoist.addTurbines') : t('hoist.newCampaign')}</h2>

        {/* Campaign name (optional) — create mode only */}
        {!isAdd && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>{t('hoist.campaignName')}</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('hoist.campaignNamePlaceholder')}
              maxLength={40}
              disabled={isSaving}
            />
            <span style={charCountStyle}>{name.length}/40</span>
          </div>
        )}

        {/* Turbine multi-select */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={listHeaderStyle}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              {t('hoist.turbines')} * · {selected.size} {t('hoist.selectedTurbines')}
            </label>
            <span style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                style={linkBtnStyle}
                onClick={() => setSelected(new Set(available.map((tr) => tr.id)))}
                disabled={isSaving || available.length === 0}
              >
                {t('hoist.selectAll')}
              </button>
              <button
                type="button"
                style={linkBtnStyle}
                onClick={() => setSelected(new Set())}
                disabled={isSaving || selected.size === 0}
              >
                {t('hoist.selectNone')}
              </button>
            </span>
          </div>
          <div style={turbineListStyle}>
            {isLoading ? (
              <p style={mutedStyle}>{t('general.loading')}</p>
            ) : (
              (turbines ?? []).map((tr) => {
                const inCampaign = existing.has(tr.id);
                return (
                  <label
                    key={tr.id}
                    style={{ ...turbineRowStyle, opacity: inCampaign ? 0.5 : 1 }}
                    title={inCampaign ? t('hoist.alreadyInCampaign') : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={inCampaign || selected.has(tr.id)}
                      disabled={inCampaign || isSaving}
                      onChange={() => toggle(tr.id)}
                    />
                    <span>{tr.name}</span>
                    {tr.model ? <span style={mutedStyle}>{tr.model}</span> : null}
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div style={footerStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={isSaving}>
            {t('button.cancel')}
          </button>
          <button style={saveBtnStyle} onClick={handleSave} disabled={selected.size === 0 || isSaving}>
            {isSaving ? t('campaigns.saving') : isAdd ? t('hoist.addTurbines') : t('button.create')}
          </button>
        </div>
      </div>
    </div>
  );
}

const listHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
};
const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#5A8F5A', fontSize: 'var(--text-xs)',
  fontWeight: 600, cursor: 'pointer', padding: 0,
};
const turbineListStyle: React.CSSProperties = {
  maxHeight: 280, overflowY: 'auto', border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-md)', padding: '4px 0',
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
};
const turbineRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
  fontSize: 'var(--text-sm)', cursor: 'pointer',
};
const mutedStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)', color: 'var(--color-neutral-400)', margin: 0,
};
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
