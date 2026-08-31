import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Star, X } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import {
  useRepairCampaignDetail,
  useRepairPhotos,
  useSetPhotoSelected,
} from '@/hooks/useRepair';
import { getRepairStageLabel, REPAIR_STAGES } from '@/constants/repair-stages';
import { generateAndDownloadRepairReport } from '@/services/repairReportPdf.service';
import type { RepairPhoto } from '@/services/repair.service';

const C = {
  brand: '#5A8F5A',
  text: '#535353',
  muted: '#8A9099',
  border: '#E5E7EB',
};

export function RepairWorkflow() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const toast = useToast();

  const { data: campaign, isLoading: campaignLoading } = useRepairCampaignDetail(campaignId);
  const { data: stagePhotos, isLoading: photosLoading } = useRepairPhotos(campaignId);
  const setSelected = useSetPhotoSelected(campaignId);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleSelect = (photo: RepairPhoto, selected: boolean) => {
    if (photo.repairSelected === selected) return;
    setSelected.mutate({ photoId: photo.id, selected });
  };

  const handleDownloadPdf = async () => {
    if (!campaignId) return;
    setDownloading(true);
    try {
      await generateAndDownloadRepairReport({ campaignId });
    } catch (err) {
      toast.error((err as Error)?.message || t('repair.pdfError'));
    } finally {
      setDownloading(false);
    }
  };

  if (campaignLoading) {
    return <div style={page}><p style={{ color: C.muted }}>{t('general.loading')}</p></div>;
  }

  return (
    <div style={page}>
      <div style={header}>
        <button style={backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> {t('general.back')}
        </button>
        <div style={headerRow}>
          <div>
            <h1 style={title}>{t('repair.workflowTitle')}</h1>
            <p style={subtitle}>
              {campaign?.turbineName ?? '—'}
              {campaign?.windFarmName ? ` · ${campaign.windFarmName}` : ''}
            </p>
          </div>
          <button style={pdfBtn} disabled={downloading} onClick={handleDownloadPdf}>
            {downloading ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download size={16} />
            )}
            {t('repair.downloadReport')}
          </button>
        </div>
      </div>

      <p style={hint}>{t('repair.workflowHint')}</p>

      {photosLoading ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('general.loading')}</p>
      ) : (
        <div style={stagesWrap}>
          {REPAIR_STAGES.map((stage) => {
            const group = stagePhotos?.find((g) => g.stageKey === stage.key);
            const photos = group?.photos ?? [];
            const available = photos.filter((p) => !p.repairSelected);
            const selected = photos.filter((p) => p.repairSelected);

            return (
              <div key={stage.key} style={stageCard}>
                <div style={stageHeader}>
                  <span style={stageOrder}>{stage.order}</span>
                  <h2 style={stageTitle}>{getRepairStageLabel(stage.key, locale)}</h2>
                  <span style={stageCount}>
                    {photos.length} {t('repair.photos')} · {selected.length} {t('repair.selected')}
                  </span>
                </div>

                {photos.length === 0 ? (
                  <p style={emptyStage}>{t('repair.noPhotosStage')}</p>
                ) : (
                  <div style={columns}>
                    {/* Left: all photos of the stage (drag source) */}
                    <div style={col}>
                      <div style={colTitle}>{t('repair.allPhotos')}</div>
                      <div style={grid}>
                        {available.length === 0 ? (
                          <p style={colEmpty}>{t('repair.allSelectedStage')}</p>
                        ) : (
                          available.map((photo) => (
                            <PhotoCard
                              key={photo.id}
                              photo={photo}
                              dimmed={dragId === photo.id}
                              onDragStart={() => setDragId(photo.id)}
                              onDragEnd={() => setDragId(null)}
                              action="add"
                              actionLabel={t('repair.select')}
                              onAction={() => handleSelect(photo, true)}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    {/* Right: selected photos (drop zone) */}
                    <div
                      style={{ ...col, ...(dropStage === stage.key ? colDropActive : {}) }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDropStage(stage.key);
                      }}
                      onDragLeave={() => setDropStage((s) => (s === stage.key ? null : s))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDropStage(null);
                        const id = e.dataTransfer.getData('text/plain') || dragId;
                        const photo = photos.find((p) => p.id === id);
                        if (photo) handleSelect(photo, true);
                        setDragId(null);
                      }}
                    >
                      <div style={colTitle}>
                        <Star size={13} color={C.brand} /> {t('repair.selectedForReport')}
                      </div>
                      <div style={grid}>
                        {selected.length === 0 ? (
                          <p style={dropPlaceholder}>{t('repair.dropHere')}</p>
                        ) : (
                          selected.map((photo) => (
                            <PhotoCard
                              key={photo.id}
                              photo={photo}
                              dimmed={dragId === photo.id}
                              onDragStart={() => setDragId(photo.id)}
                              onDragEnd={() => setDragId(null)}
                              action="remove"
                              actionLabel={t('repair.remove')}
                              onAction={() => handleSelect(photo, false)}
                              selected
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Photo card ───────────────────────────────────────────────────────────────

interface PhotoCardProps {
  photo: RepairPhoto;
  dimmed: boolean;
  selected?: boolean;
  action: 'add' | 'remove';
  actionLabel: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAction: () => void;
}

function PhotoCard({
  photo,
  dimmed,
  selected,
  action,
  actionLabel,
  onDragStart,
  onDragEnd,
  onAction,
}: PhotoCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', photo.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDoubleClick={onAction}
      style={{ ...photoCard, opacity: dimmed ? 0.5 : 1, borderColor: selected ? C.brand : C.border }}
      title={photo.filename}
    >
      {photo.url ? (
        <img src={photo.url} alt={photo.filename} style={photoImg} loading="lazy" />
      ) : (
        <div style={photoBroken}>—</div>
      )}
      <button
        style={{ ...photoActionBtn, background: action === 'remove' ? '#EF4444' : C.brand }}
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        aria-label={actionLabel}
        title={actionLabel}
      >
        {action === 'remove' ? <X size={13} /> : <Star size={13} />}
      </button>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { padding: 24, fontFamily: 'var(--font-family-sans)' };
const header: React.CSSProperties = { marginBottom: 12 };
const headerRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
};
const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
  cursor: 'pointer', color: C.muted, fontSize: 13, marginBottom: 12, padding: 0,
};
const title: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: 0 };
const subtitle: React.CSSProperties = { fontSize: 13, color: C.muted, margin: '4px 0 0' };
const hint: React.CSSProperties = { fontSize: 13, color: C.muted, marginBottom: 20 };
const pdfBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, background: C.brand, color: '#fff',
  border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const stagesWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };
const stageCard: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: '#fff',
};
const stageHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 };
const stageOrder: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24,
  borderRadius: '50%', background: C.brand, color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
};
const stageTitle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#1a1a1a', margin: 0, flex: 1 };
const stageCount: React.CSSProperties = { fontSize: 12, color: C.muted };
const emptyStage: React.CSSProperties = { fontSize: 13, color: C.muted, padding: '8px 0' };
const columns: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const col: React.CSSProperties = {
  border: `1px dashed ${C.border}`, borderRadius: 10, padding: 10, minHeight: 120, transition: 'border-color 0.15s',
};
const colDropActive: React.CSSProperties = { borderColor: C.brand, background: 'rgba(90,143,90,0.05)' };
const colTitle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8,
};
const grid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8,
};
const colEmpty: React.CSSProperties = { fontSize: 12, color: C.muted, gridColumn: '1 / -1' };
const dropPlaceholder: React.CSSProperties = {
  fontSize: 12, color: C.muted, textAlign: 'center', padding: '16px 0', gridColumn: '1 / -1',
};
const photoCard: React.CSSProperties = {
  position: 'relative', border: `2px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
  cursor: 'grab', aspectRatio: '4 / 3', background: '#f3f4f6',
};
const photoImg: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const photoBroken: React.CSSProperties = {
  width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted,
};
const photoActionBtn: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
