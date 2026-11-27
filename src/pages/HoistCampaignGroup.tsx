import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Download, ExternalLink, Loader2, Plus } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import { useAuth } from '@/hooks/useAuth';
import { useHoistGroup } from '@/hooks/useHoistCertification';
import { NewHoistCertificationModal } from '@/components/organisms/NewHoistCertificationModal';
import { generateAndDownloadHoistCertificationReport } from '@/services/hoistCertificationReportPdf.service';
import { HoistCertificationWorkflow } from '@/pages/HoistCertificationWorkflow';
import type { HoistGroupTurbine } from '@/services/hoistCertification.service';
import type { HoistReportVariant } from '@/services/hoistCertificationReportPdf.service';

const C = {
  brand: '#5A8F5A',
  muted: '#8A9099',
  border: '#E5E7EB',
};

const STATUS_CHIP: Record<string, React.CSSProperties> = {
  hoist_open: { background: '#FEF9C3', color: '#854D0E' },
  hoist_in_progress: { background: '#DBEAFE', color: '#1E40AF' },
  hoist_done: { background: '#DEF7EC', color: '#03543F' },
};
const STATUS_KEY: Record<string, string> = {
  hoist_open: 'hoist.statusOpen',
  hoist_in_progress: 'hoist.statusInProgress',
  hoist_done: 'hoist.statusDone',
};

/** Campaign status from its turbines: all done → done, any started → in progress. */
function groupStatus(turbines: HoistGroupTurbine[], fallback: string): string {
  if (turbines.length === 0) return fallback;
  if (turbines.every((tb) => tb.status === 'hoist_done')) return 'hoist_done';
  if (turbines.some((tb) => tb.status !== 'hoist_open')) return 'hoist_in_progress';
  return 'hoist_open';
}

/**
 * Parent hoist-certification campaign: lists every turbine of the campaign as a
 * collapsible row (same look as the "Pala Nº" rows of the repair workflow).
 * Expanding a turbine shows its full certification (steps, items, photos,
 * hoist data) — the same HoistCertificationWorkflow, embedded. "Generar
 * informe" builds ONE report with the turbines that have all their data.
 */
export function HoistCampaignGroup() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const toast = useToast();
  const { role } = useAuth();
  const isClient = role === 'client';
  const { data: group, isLoading } = useHoistGroup(groupId);
  const [downloading, setDownloading] = useState<HoistReportVariant | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const initialOpen = searchParams.get('turbine');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(initialOpen ? [initialOpen] : []));

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const turbines = group?.turbines ?? [];
  const complete = turbines.filter((tb) => tb.complete);
  // Main report: certified / certified with observations. Anexo II: no certificado.
  const certifiedIds = complete.filter((tb) => tb.condition !== 'no_certificado').map((tb) => tb.campaignId);
  const notCertifiedIds = complete.filter((tb) => tb.condition === 'no_certificado').map((tb) => tb.campaignId);

  const handleReport = async (variant: HoistReportVariant) => {
    if (!group || downloading) return;
    const ids = variant === 'not_certified' ? notCertifiedIds : certifiedIds;
    if (ids.length === 0) {
      toast.error(t('hoist.noCompleteTurbines'));
      return;
    }
    setDownloading(variant);
    try {
      await generateAndDownloadHoistCertificationReport({
        campaignIds: ids,
        campaignName: group.name,
        variant,
      });
    } catch (err) {
      toast.error((err as Error)?.message || t('hoist.pdfError'));
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return <div style={page}><p style={{ color: C.muted }}>{t('general.loading')}</p></div>;
  }
  if (!group) {
    return <div style={page}><p style={{ color: C.muted }}>{t('hoist.noTurbines')}</p></div>;
  }

  const status = groupStatus(turbines, group.status);

  return (
    <div style={page}>
      <button style={backBtn} onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> {t('general.back')}
      </button>
      <div style={headerRow}>
        <div>
          <h1 style={title}>
            {group.name}
            <span style={{ ...statusChip, ...(STATUS_CHIP[status] ?? {}) }}>
              {t(STATUS_KEY[status] ?? 'hoist.statusOpen')}
            </span>
          </h1>
          <p style={subtitle}>
            {t('campaign.typeHoistCertification')}
            {group.windFarmName ? ` · ${group.windFarmName}` : ''} · {turbines.length} {t('hoist.turbines').toLowerCase()}
          </p>
        </div>
        <div style={headerActions}>
          {!isClient && (
            <button type="button" style={secondaryBtn} onClick={() => setShowAdd(true)}>
              <Plus size={14} /> {t('hoist.addTurbines')}
            </button>
          )}
          <button
            type="button"
            style={{ ...reportBtn, opacity: downloading ? 0.5 : 1, cursor: downloading ? 'not-allowed' : 'pointer' }}
            onClick={() => void handleReport('certified')}
            disabled={!!downloading}
            title={t('hoist.reportIncludes')}
          >
            {downloading === 'certified' ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download size={14} />
            )}
            {t('hoist.generateReport')} ({certifiedIds.length}/{turbines.length})
          </button>
          <button
            type="button"
            style={{
              ...notCertifiedBtn,
              opacity: downloading || notCertifiedIds.length === 0 ? 0.5 : 1,
              cursor: downloading || notCertifiedIds.length === 0 ? 'not-allowed' : 'pointer',
            }}
            onClick={() => void handleReport('not_certified')}
            disabled={!!downloading || notCertifiedIds.length === 0}
            title={t('hoist.notCertifiedReportIncludes')}
          >
            {downloading === 'not_certified' ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download size={14} />
            )}
            {t('hoist.generateNotCertifiedReport')} ({notCertifiedIds.length})
          </button>
        </div>
      </div>
      <p style={hint}>{t('hoist.reportIncludes')}. {t('hoist.notCertifiedReportIncludes')}.</p>

      {turbines.length === 0 ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('hoist.noTurbines')}</p>
      ) : (
        <div style={list}>
          {turbines.map((tb) => {
            const open = openIds.has(tb.campaignId);
            return (
              <div key={tb.campaignId} style={turbineGroup}>
                <div style={turbineHeader}>
                  <button style={turbineToggle} onClick={() => toggle(tb.campaignId)}>
                    {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    <span style={turbineTitle}>
                      {t('hoist.turbine')} {tb.turbineName}
                    </span>
                    <span style={{ ...statusChip, marginLeft: 0, ...(STATUS_CHIP[tb.status] ?? {}) }}>
                      {t(STATUS_KEY[tb.status] ?? 'hoist.statusOpen')}
                    </span>
                    <span style={turbineCount}>
                      {tb.photosCount} {t('hoist.photos')} · {t('hoist.colItems')} {tb.itemsWithData}/{tb.totalItems}
                    </span>
                    {tb.condition === 'no_certificado' && (
                      <span style={notCertifiedChip}>{t('hoist.notCertified')}</span>
                    )}
                    <span style={tb.complete ? completeChip : incompleteChip}>
                      {tb.complete ? t('hoist.complete') : t('hoist.incomplete')}
                    </span>
                  </button>
                  <button
                    type="button"
                    style={openBtn}
                    onClick={() => navigate(`/hoist-certification/${tb.campaignId}`)}
                    title={t('hoist.openTurbine')}
                    aria-label={t('hoist.openTurbine')}
                  >
                    <ExternalLink size={15} />
                  </button>
                </div>
                {open && <HoistCertificationWorkflow campaignId={tb.campaignId} embedded />}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <NewHoistCertificationModal
          windFarmId={group.windFarmId}
          isOpen
          onClose={() => setShowAdd(false)}
          groupId={group.id}
          existingTurbineIds={turbines.map((tb) => tb.turbineId).filter((x): x is string => !!x)}
        />
      )}
    </div>
  );
}

const page: React.CSSProperties = { padding: 24, fontFamily: 'var(--font-family-sans)' };
const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
  cursor: 'pointer', color: C.muted, fontSize: 13, marginBottom: 12, padding: 0,
};
const headerRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
};
const title: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: 0 };
const subtitle: React.CSSProperties = { fontSize: 13, color: C.muted, margin: '4px 0 0' };
const hint: React.CSSProperties = { fontSize: 12, color: C.muted, margin: '12px 0 16px' };
const headerActions: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };
const statusChip: React.CSSProperties = {
  marginLeft: 10, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
  verticalAlign: 'middle', flexShrink: 0,
};
const reportBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: C.brand, color: '#fff',
  border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600,
};
const notCertifiedBtn: React.CSSProperties = { ...reportBtn, background: '#B91C1C' };
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: C.brand,
  border: `1px solid ${C.brand}`, borderRadius: 8, padding: '7px 14px', fontSize: 12,
  fontWeight: 600, cursor: 'pointer',
};
const list: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
// Same look as RepairWorkflow's blade group rows ("Pala Nº …").
const turbineGroup: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', overflow: 'hidden',
};
const turbineHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', background: '#EFF5EF', borderLeft: '4px solid #5A8F5A',
};
const turbineToggle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: '14px 16px',
  background: 'none', border: 'none', cursor: 'pointer', color: '#111827',
};
const turbineTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: '#111827', flex: 1, textAlign: 'left',
};
const turbineCount: React.CSSProperties = { fontSize: 12, color: C.muted, flexShrink: 0 };
const completeChip: React.CSSProperties = {
  ...statusChip, marginLeft: 0, background: '#DEF7EC', color: '#03543F',
};
const notCertifiedChip: React.CSSProperties = {
  ...statusChip, marginLeft: 0, background: '#FEE2E2', color: '#B91C1C',
};
const incompleteChip: React.CSSProperties = {
  ...statusChip, marginLeft: 0, background: '#F3F4F6', color: '#6B7280',
};
const openBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: C.brand, padding: '0 16px',
  display: 'flex', alignItems: 'center', alignSelf: 'stretch',
};
