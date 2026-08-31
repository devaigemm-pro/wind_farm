import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Download, Loader2, Star, X } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import {
  useRepairCampaignDetail,
  useRepairTree,
  useSetPhotoSelected,
} from '@/hooks/useRepair';
import { getRepairStageLabel, REPAIR_STAGES } from '@/constants/repair-stages';
import { generateAndDownloadRepairReport } from '@/services/repairReportPdf.service';
import type { RepairDefectNode, RepairPhoto } from '@/services/repair.service';

const C = {
  brand: '#5A8F5A',
  text: '#535353',
  muted: '#8A9099',
  border: '#E5E7EB',
};

const BLADE_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

const DEFECT_TYPE_LABELS: Record<string, { es: string; en: string }> = {
  le_erosion: { es: 'Erosión LE', en: 'LE erosion' },
  vortex: { es: 'Vortex', en: 'Vortex' },
  paint_defect: { es: 'Daños de pintura', en: 'Paint defect' },
  crack: { es: 'Grieta', en: 'Crack' },
  delamination: { es: 'Delaminación', en: 'Delamination' },
  lightning_damage: { es: 'Daño por rayo', en: 'Lightning damage' },
  other: { es: 'Otros', en: 'Other' },
};

function formatDefectType(type: string, locale: 'es' | 'en'): string {
  const label = DEFECT_TYPE_LABELS[type];
  if (label) return locale === 'es' ? label.es : label.en;
  return type.replace(/_/g, ' ');
}

export function RepairWorkflow() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const toast = useToast();

  const { data: campaign, isLoading: campaignLoading } = useRepairCampaignDetail(campaignId);
  const { data: tree, isLoading: treeLoading } = useRepairTree(campaignId);
  const setSelected = useSetPhotoSelected(campaignId);

  const [downloading, setDownloading] = useState(false);
  const [lightbox, setLightbox] = useState<RepairPhoto | null>(null);

  const handleSelect = (photo: RepairPhoto, selected: boolean) => {
    if (photo.repairSelected === selected) return;
    setSelected.mutate({ photoId: photo.id, selected });
  };

  const handlePreview = (photo: RepairPhoto) => {
    if (photo.url) setLightbox(photo);
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

      {treeLoading ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('general.loading')}</p>
      ) : !tree || tree.length === 0 ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('repair.noDefects')}</p>
      ) : (
        <div style={defectsWrap}>
          {tree.map((node, idx) => (
            <DefectSection
              key={node.defect.id}
              node={node}
              index={idx}
              locale={locale}
              t={t}
              onSelect={handleSelect}
              onPreview={handlePreview}
            />
          ))}
        </div>
      )}

      {/* Lightbox: enlarged photo preview */}
      {lightbox && (
        <div
          style={lightboxOverlay}
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button style={lightboxClose} onClick={() => setLightbox(null)} aria-label={t('general.close')}>
            <X size={22} />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.filename}
            style={lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={lightboxCaption} onClick={(e) => e.stopPropagation()}>
            {lightbox.filename}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Defect section (level 1) ──────────────────────────────────────────────────

interface DefectSectionProps {
  node: RepairDefectNode;
  index: number;
  locale: 'es' | 'en';
  t: (key: string) => string;
  onSelect: (photo: RepairPhoto, selected: boolean) => void;
  onPreview: (photo: RepairPhoto) => void;
}

function DefectSection({ node, index, locale, t, onSelect, onPreview }: DefectSectionProps) {
  const [open, setOpen] = useState(true);
  const { defect } = node;

  const totalPhotos = node.stages.reduce((acc, s) => acc + s.photos.length, 0);
  const selectedPhotos = node.stages.reduce(
    (acc, s) => acc + s.photos.filter((p) => p.repairSelected).length,
    0,
  );
  const bladeLabel = BLADE_LABELS[defect.bladePosition] || String(defect.bladePosition);

  return (
    <div style={defectCard}>
      <button style={defectHeader} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <span style={defectIndex}>{index + 1}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={defectTitle}>
            {t('repair.defect')} #{index + 1} · {formatDefectType(defect.type, locale)}
          </div>
          <div style={defectMeta}>
            {t('repair.blade')} {bladeLabel}
            {' · '}{t('repair.category')} {defect.severity || '—'}
            {defect.side ? ` · ${defect.side}` : ''}
          </div>
        </div>
        <span style={defectCount}>
          {totalPhotos} {t('repair.photos')} · {selectedPhotos} {t('repair.selected')}
        </span>
      </button>

      {open && (
        <div style={stagesWrap}>
          {REPAIR_STAGES.map((stage) => {
            const group = node.stages.find((s) => s.stageKey === stage.key);
            const photos = group?.photos ?? [];
            return (
              <StageRow
                key={stage.key}
                defectId={defect.id}
                stageKey={stage.key}
                order={stage.order}
                label={getRepairStageLabel(stage.key, locale)}
                photos={photos}
                t={t}
                onSelect={onSelect}
                onPreview={onPreview}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Stage row (level 2, with drag&drop) ────────────────────────────────────────

interface StageRowProps {
  defectId: string;
  stageKey: string;
  order: number;
  label: string;
  photos: RepairPhoto[];
  t: (key: string) => string;
  onSelect: (photo: RepairPhoto, selected: boolean) => void;
  onPreview: (photo: RepairPhoto) => void;
}

function StageRow({ defectId, stageKey, order, label, photos, t, onSelect, onPreview }: StageRowProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const available = photos.filter((p) => !p.repairSelected);
  const selected = photos.filter((p) => p.repairSelected);
  // Scope drop zone to this defect+stage to avoid cross-stage drops.
  const dropKey = `${defectId}::${stageKey}`;

  return (
    <div style={stageCard}>
      <div style={stageHeader}>
        <span style={stageOrder}>{order}</span>
        <h3 style={stageTitle}>{label}</h3>
        <span style={stageCount}>
          {photos.length} {t('repair.photos')} · {selected.length} {t('repair.selected')}
        </span>
      </div>

      {photos.length === 0 ? (
        <p style={emptyStage}>{t('repair.noPhotosStage')}</p>
      ) : (
        <div style={columns}>
          {/* Left: all photos of the defect+stage (drag source) */}
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
                    onAction={() => onSelect(photo, true)}
                    onPreview={() => onPreview(photo)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: selected photos (drop zone) */}
          <div
            style={{ ...col, ...(dropActive ? colDropActive : {}) }}
            data-drop={dropKey}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              const id = e.dataTransfer.getData('text/plain') || dragId;
              const photo = photos.find((p) => p.id === id);
              if (photo) onSelect(photo, true);
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
                    onAction={() => onSelect(photo, false)}
                    onPreview={() => onPreview(photo)}
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
  onPreview: () => void;
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
  onPreview,
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
      onClick={onPreview}
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
const defectsWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };
const defectCard: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', overflow: 'hidden',
};
const defectHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px',
  background: '#F7FAF7', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer',
  color: C.text,
};
const defectIndex: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
  borderRadius: '50%', background: C.brand, color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
};
const defectTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1a1a1a' };
const defectMeta: React.CSSProperties = { fontSize: 12, color: C.muted, marginTop: 2 };
const defectCount: React.CSSProperties = { fontSize: 12, color: C.muted, flexShrink: 0 };
const stagesWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 };
const stageCard: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, background: '#fff',
};
const stageHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };
const stageOrder: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
  borderRadius: '50%', background: 'rgba(90,143,90,0.15)', color: C.brand, fontSize: 11, fontWeight: 700, flexShrink: 0,
};
const stageTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0, flex: 1 };
const stageCount: React.CSSProperties = { fontSize: 12, color: C.muted };
const emptyStage: React.CSSProperties = { fontSize: 13, color: C.muted, padding: '4px 0' };
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
const lightboxOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 32, cursor: 'zoom-out',
};
const lightboxImg: React.CSSProperties = {
  maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8,
  boxShadow: '0 8px 40px rgba(0,0,0,0.5)', cursor: 'default',
};
const lightboxClose: React.CSSProperties = {
  position: 'fixed', top: 20, right: 24, width: 40, height: 40, borderRadius: '50%',
  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const lightboxCaption: React.CSSProperties = {
  marginTop: 12, color: '#fff', fontSize: 13, opacity: 0.85, cursor: 'default',
};
