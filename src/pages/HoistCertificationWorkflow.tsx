import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Star,
  X,
  Download,
  Check,
  Ruler,
  Camera,
  CircleCheck,
  CircleX,
  CircleDashed,
} from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import { useAuth } from '@/hooks/useAuth';
import {
  useHoistCampaignDetail,
  useHoistTree,
  useSetHoistPhotoSelected,
  useMoveHoistPhoto,
} from '@/hooks/useHoistCertification';
import { generateAndDownloadHoistCertificationReport } from '@/services/hoistCertificationReportPdf.service';
import { getHoistLabel } from '@/constants/hoist-certification-steps';
import type {
  HoistPhoto,
  HoistStepNode,
  HoistGroupNode,
  HoistItemNode,
} from '@/services/hoistCertification.service';

const C = {
  brand: '#5A8F5A', // shared campaign green (same as cleaning/repair)
  text: '#535353',
  muted: '#8A9099',
  border: '#E5E7EB',
  pass: '#03543F',
  passBg: '#DEF7EC',
  fail: '#991B1B',
  failBg: '#FEE2E2',
  na: '#6B7280',
  naBg: '#F3F4F6',
};

export function HoistCertificationWorkflow() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const { role } = useAuth();
  // client can view items + photos and generate/download reports, but cannot
  // select or move photos (read-only). RLS also blocks the write.
  const isClient = role === 'client';

  const { data: campaign, isLoading: campaignLoading } = useHoistCampaignDetail(campaignId);
  const { data: tree, isLoading: treeLoading } = useHoistTree(campaignId);
  const setSelected = useSetHoistPhotoSelected(campaignId);
  const movePhoto = useMoveHoistPhoto(campaignId);

  const [lightbox, setLightbox] = useState<HoistPhoto | null>(null);
  const [pendingPhotoIds, setPendingPhotoIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const handleSelect = (photo: HoistPhoto, selected: boolean) => {
    if (isClient) return;
    if (photo.hoistSelected === selected) return;
    setPendingPhotoIds((prev) => new Set(prev).add(photo.id));
    setSelected.mutate(
      { photoId: photo.id, selected },
      {
        onSettled: () =>
          setPendingPhotoIds((prev) => {
            const next = new Set(prev);
            next.delete(photo.id);
            return next;
          }),
      },
    );
  };

  // Move a photo to another item (fixing a wrong-item upload).
  const handleMovePhoto = (
    photoId: string,
    originItemCode: string,
    targetItemId: string | null,
    targetItemCode: string,
  ) => {
    if (isClient) return;
    if (originItemCode === targetItemCode) return;
    setPendingPhotoIds((prev) => new Set(prev).add(photoId));
    movePhoto.mutate(
      { photoId, targetItemId, targetItemCode },
      {
        onSuccess: () => toast.success(t('hoist.movePhotoSuccess')),
        onError: (err) => toast.error((err as Error)?.message || t('hoist.movePhotoError')),
        onSettled: () =>
          setPendingPhotoIds((prev) => {
            const next = new Set(prev);
            next.delete(photoId);
            return next;
          }),
      },
    );
  };

  const handlePreview = (photo: HoistPhoto) => {
    if (photo.url) setLightbox(photo);
  };

  const handleGenerateReport = async () => {
    if (!campaignId || downloading) return;
    setDownloading(true);
    try {
      await generateAndDownloadHoistCertificationReport({ campaignId });
    } catch (err) {
      toast.error((err as Error)?.message || t('hoist.pdfError'));
    } finally {
      setDownloading(false);
    }
  };

  if (campaignLoading) {
    return <div style={page}><p style={{ color: C.muted }}>{t('general.loading')}</p></div>;
  }

  const totalPhotos = tree ? countPhotos(tree) : 0;
  const selectedPhotos = tree ? countSelected(tree) : 0;

  return (
    <div style={page}>
      <div style={header}>
        <button style={backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> {t('general.back')}
        </button>
        <div style={headerRow}>
          <div>
            <h1 style={title}>{t('hoist.workflowTitle')}</h1>
            <p style={subtitle}>
              {campaign?.turbineName ?? '—'}
              {campaign?.windFarmName ? ` · ${campaign.windFarmName}` : ''}
            </p>
          </div>
          <span
            role="button"
            tabIndex={downloading ? -1 : 0}
            aria-disabled={downloading}
            style={{
              ...reportBtn,
              opacity: downloading ? 0.5 : 1,
              cursor: downloading ? 'not-allowed' : 'pointer',
            }}
            onClick={handleGenerateReport}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleGenerateReport();
            }}
            title={t('hoist.generateReport')}
          >
            {downloading ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download size={14} />
            )}
            {t('hoist.generateReport')}
          </span>
        </div>
      </div>

      <p style={hint}>{t('hoist.workflowHint')}</p>

      {treeLoading ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('general.loading')}</p>
      ) : !tree || tree.length === 0 ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('hoist.noSteps')}</p>
      ) : (
        <>
          <p style={totalsLine}>
            {totalPhotos} {t('hoist.photos')} · {selectedPhotos} {t('hoist.selected')}
          </p>
          <div style={stepsWrap}>
            {tree.map((step) => (
              <StepSection
                key={step.stepCode}
                step={step}
                locale={locale}
                t={t}
                readOnly={isClient}
                pendingPhotoIds={pendingPhotoIds}
                onSelect={handleSelect}
                onMovePhoto={isClient ? undefined : handleMovePhoto}
                onPreview={handlePreview}
              />
            ))}
          </div>
        </>
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function stepItems(step: HoistStepNode): HoistItemNode[] {
  if (step.hasGroups) return step.groups.flatMap((g) => g.items);
  return step.items;
}

function countPhotos(tree: HoistStepNode[]): number {
  let n = 0;
  for (const step of tree) for (const it of stepItems(step)) n += it.photos.length;
  return n;
}
function countSelected(tree: HoistStepNode[]): number {
  let n = 0;
  for (const step of tree)
    for (const it of stepItems(step)) n += it.photos.filter((p) => p.hoistSelected).length;
  return n;
}

const ITEM_MIME = 'application/x-hoist-item-code';
// Origin item code of the drag currently in flight (see ZONE_MIME in CleaningWorkflow).
let activeDragOriginItemCode: string | null = null;

// ─── Step section (level 1, collapsible) — owns the shared move highlight ───────

interface StepSectionProps {
  step: HoistStepNode;
  locale: 'es' | 'en';
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: HoistPhoto, selected: boolean) => void;
  onMovePhoto?: (
    photoId: string,
    originItemCode: string,
    targetItemId: string | null,
    targetItemCode: string,
  ) => void;
  onPreview: (photo: HoistPhoto) => void;
}

/**
 * A collapsible STEP (paso). Renders its items directly, or under sub-groups.
 * Owns the cross-item move highlight as a SINGLE shared state (`hoverTargetKey`)
 * — exactly like ZoneSection in CleaningWorkflow — so a single reset clears
 * every item at once. There is NO fragile onDragLeave on the item-move target:
 * every dragOver REASSIGNS the shared target to the item under the pointer, and
 * the reset happens on drop/dragend (one document-level listener mounted once
 * here). Guarantees exactly one highlighted item at a time with no residue.
 */
function StepSection({
  step,
  locale,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onMovePhoto,
  onPreview,
}: StepSectionProps) {
  const [open, setOpen] = useState(false);
  const [hoverTargetKey, setHoverTargetKey] = useState<string | null>(null);

  useEffect(() => {
    const clear = () => setHoverTargetKey(null);
    document.addEventListener('dragend', clear);
    document.addEventListener('drop', clear);
    return () => {
      document.removeEventListener('dragend', clear);
      document.removeEventListener('drop', clear);
    };
  }, []);

  const label = getHoistLabel(step.stepCode, locale);
  const items = stepItems(step);
  const stepPhotoCount = items.reduce((acc, it) => acc + it.photos.length, 0);

  const renderItem = (item: HoistItemNode) => (
    <ItemRow
      key={item.itemId ?? item.itemCode}
      item={item}
      locale={locale}
      t={t}
      readOnly={readOnly}
      pendingPhotoIds={pendingPhotoIds}
      onSelect={onSelect}
      onMovePhoto={onMovePhoto}
      onPreview={onPreview}
      hoverTargetKey={hoverTargetKey}
      setHoverTargetKey={setHoverTargetKey}
    />
  );

  return (
    <div style={stepGroup}>
      <button style={stepGroupHeader} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <span style={stepGroupTitle}>{label}</span>
        <span style={stepGroupCount}>
          {items.length} {t('hoist.items')} · {stepPhotoCount} {t('hoist.photos')}
        </span>
      </button>

      {open && (
        <div style={stepGroupBody}>
          {step.hasGroups ? (
            step.groups.map((group: HoistGroupNode) => (
              <div key={group.groupCode} style={subGroupBlock}>
                <div style={subGroupTitle}>{getHoistLabel(group.groupCode, locale)}</div>
                <div style={subGroupItems}>{group.items.map(renderItem)}</div>
              </div>
            ))
          ) : (
            <div style={subGroupItems}>{items.map(renderItem)}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Item row (typed leaf) ──────────────────────────────────────────────────────

interface ItemRowProps {
  item: HoistItemNode;
  locale: 'es' | 'en';
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: HoistPhoto, selected: boolean) => void;
  onMovePhoto?: (
    photoId: string,
    originItemCode: string,
    targetItemId: string | null,
    targetItemCode: string,
  ) => void;
  onPreview: (photo: HoistPhoto) => void;
  hoverTargetKey: string | null;
  setHoverTargetKey: (key: string | null) => void;
}

/**
 * One typed ITEM. Renders according to item.itemType:
 *   - 'check'        → a cumple/no cumple badge (verde/rojo) or "sin dato".
 *   - 'measurement'  → the measured value (+ unit) badge, then a photo gallery.
 *   - 'photo'        → a photo gallery only.
 * Photo items ('photo' and 'measurement') expose the same two-column drag&drop
 * selection used by CleaningWorkflow (shared hover target, no fragile dragLeave).
 */
function ItemRow({
  item,
  locale,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onMovePhoto,
  onPreview,
  hoverTargetKey,
  setHoverTargetKey,
}: ItemRowProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const thisKey = item.itemId ?? item.itemCode;
  const hasPhotos = item.itemType === 'photo' || item.itemType === 'measurement';
  const itemDropActive = hoverTargetKey != null && hoverTargetKey === thisKey;

  useEffect(() => {
    const clear = () => setDropActive(false);
    document.addEventListener('dragend', clear);
    document.addEventListener('drop', clear);
    return () => {
      document.removeEventListener('dragend', clear);
      document.removeEventListener('drop', clear);
    };
  }, []);

  const photos = item.photos;
  const available = photos.filter((p) => !p.hoistSelected);
  const selected = photos.filter((p) => p.hoistSelected);

  // A photo-bearing item can RECEIVE a moved photo whenever writable.
  const canReceiveMove = hasPhotos && !readOnly && !!onMovePhoto;

  const isForeignDrag = (e: React.DragEvent) => {
    const origin = activeDragOriginItemCode ?? e.dataTransfer.getData(ITEM_MIME);
    return origin !== item.itemCode;
  };

  const TypeIcon =
    item.itemType === 'check' ? Check : item.itemType === 'measurement' ? Ruler : Camera;

  return (
    <div
      style={{ ...itemCard, ...(itemDropActive ? itemDropActiveStyle : {}) }}
      onDragOver={
        canReceiveMove
          ? (e) => {
              if (!isForeignDrag(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setHoverTargetKey(thisKey);
            }
          : undefined
      }
      // No onDragLeave on purpose (same reasoning as CleaningWorkflow ZoneRow).
      onDrop={
        canReceiveMove
          ? (e) => {
              const origin =
                e.dataTransfer.getData(ITEM_MIME) || (activeDragOriginItemCode ?? '');
              if (origin === item.itemCode) return; // same-item → inner column handles it
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain') || dragId;
              if (id && onMovePhoto) {
                onMovePhoto(id, origin, item.itemId, item.itemCode);
              }
              setHoverTargetKey(null);
            }
          : undefined
      }
    >
      <div style={itemRowHeader}>
        <span style={itemTypeChip}>
          <TypeIcon size={12} />
          {t(`hoist.type.${item.itemType}`)}
        </span>
        <h3 style={itemRowTitle}>{getHoistLabel(item.itemCode, locale)}</h3>
        {/* State badge for check / measurement */}
        {item.itemType === 'check' && <CheckBadge passed={item.passed} t={t} />}
        {item.itemType === 'measurement' && (
          <MeasurementBadge value={item.measurementValue} unit={item.measurementUnit} t={t} />
        )}
        {hasPhotos && (
          <span style={itemRowCount}>
            {photos.length} {t('hoist.photos')} · {selected.length} {t('hoist.selected')}
          </span>
        )}
      </div>

      {/* Photo items: two-column selection grid. Check items: no gallery. */}
      {!hasPhotos ? null : photos.length === 0 ? (
        <p style={emptyItem}>{t('hoist.noPhotosItem')}</p>
      ) : (
        <div style={columns}>
          {/* Left: all photos of the item (drag source) */}
          <div style={col}>
            <div style={colTitle}>{t('hoist.allPhotos')}</div>
            <div style={grid}>
              {available.length === 0 ? (
                <p style={colEmpty}>{t('hoist.allSelectedItem')}</p>
              ) : (
                available.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    originItemCode={item.itemCode}
                    dimmed={dragId === photo.id}
                    pending={pendingPhotoIds.has(photo.id)}
                    readOnly={readOnly}
                    onDragStart={() => setDragId(photo.id)}
                    onDragEnd={() => setDragId(null)}
                    action="add"
                    actionLabel={t('hoist.select')}
                    onAction={() => onSelect(photo, true)}
                    onPreview={() => onPreview(photo)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: selected photos (drop zone). Handles ONLY same-item selection. */}
          <div
            style={{ ...col, ...(dropActive ? colDropActive : {}) }}
            onDragOver={
              readOnly
                ? undefined
                : (e) => {
                    if (isForeignDrag(e)) return; // foreign → bubble to item move zone
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    setDropActive(true);
                    if (hoverTargetKey === thisKey) setHoverTargetKey(null);
                  }
            }
            onDragLeave={readOnly ? undefined : () => setDropActive(false)}
            onDrop={
              readOnly
                ? undefined
                : (e) => {
                    if (isForeignDrag(e)) return; // handled by item-level drop
                    e.preventDefault();
                    e.stopPropagation();
                    setDropActive(false);
                    const id = e.dataTransfer.getData('text/plain') || dragId;
                    const photo = photos.find((p) => p.id === id);
                    if (photo) onSelect(photo, true);
                    setDragId(null);
                  }
            }
          >
            <div style={colTitle}>
              <Star size={13} color={C.brand} /> {t('hoist.selectedForReport')}
            </div>
            <div style={grid}>
              {selected.length === 0 ? (
                <p style={dropPlaceholder}>{t('hoist.dropHere')}</p>
              ) : (
                selected.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    originItemCode={item.itemCode}
                    dimmed={dragId === photo.id}
                    pending={pendingPhotoIds.has(photo.id)}
                    readOnly={readOnly}
                    onDragStart={() => setDragId(photo.id)}
                    onDragEnd={() => setDragId(null)}
                    action="remove"
                    actionLabel={t('hoist.remove')}
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

// ─── State badges (check / measurement) ─────────────────────────────────────────

function CheckBadge({ passed, t }: { passed: boolean | null; t: (k: string) => string }) {
  if (passed === true) {
    return (
      <span style={{ ...stateBadge, background: C.passBg, color: C.pass }}>
        <CircleCheck size={13} /> {t('hoist.pass')}
      </span>
    );
  }
  if (passed === false) {
    return (
      <span style={{ ...stateBadge, background: C.failBg, color: C.fail }}>
        <CircleX size={13} /> {t('hoist.fail')}
      </span>
    );
  }
  return (
    <span style={{ ...stateBadge, background: C.naBg, color: C.na }}>
      <CircleDashed size={13} /> {t('hoist.noData')}
    </span>
  );
}

function MeasurementBadge({
  value,
  unit,
  t,
}: {
  value: number | string | null;
  unit: string | null;
  t: (k: string) => string;
}) {
  if (value === null || value === '') {
    return (
      <span style={{ ...stateBadge, background: C.naBg, color: C.na }}>
        <CircleDashed size={13} /> {t('hoist.noData')}
      </span>
    );
  }
  return (
    <span style={{ ...stateBadge, background: '#EFF5EF', color: C.brand }}>
      <Ruler size={13} /> {value}
      {unit ? ` ${unit}` : ''}
    </span>
  );
}

// ─── Photo card ───────────────────────────────────────────────────────────────

interface PhotoCardProps {
  photo: HoistPhoto;
  originItemCode: string;
  dimmed: boolean;
  pending?: boolean;
  selected?: boolean;
  readOnly?: boolean;
  action: 'add' | 'remove';
  actionLabel: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAction: () => void;
  onPreview: () => void;
}

function PhotoCard({
  photo,
  originItemCode,
  dimmed,
  pending,
  selected,
  readOnly,
  action,
  actionLabel,
  onDragStart,
  onDragEnd,
  onAction,
  onPreview,
}: PhotoCardProps) {
  const interactive = !readOnly && !pending;
  return (
    <div style={photoCardWrap}>
      <div
        draggable={interactive}
        onDragStart={
          interactive
            ? (e) => {
                e.dataTransfer.setData('text/plain', photo.id);
                e.dataTransfer.setData(ITEM_MIME, originItemCode);
                activeDragOriginItemCode = originItemCode;
                e.dataTransfer.effectAllowed = 'move';
                onDragStart();
              }
            : undefined
        }
        onDragEnd={
          interactive
            ? () => {
                activeDragOriginItemCode = null;
                onDragEnd();
              }
            : undefined
        }
        onClick={onPreview}
        onDoubleClick={interactive ? onAction : undefined}
        style={{
          ...photoCard,
          opacity: dimmed ? 0.5 : 1,
          borderColor: selected ? C.brand : C.border,
          cursor: readOnly ? 'zoom-in' : pending ? 'progress' : 'grab',
        }}
        title={photo.filename}
      >
        {photo.thumbnailUrl ? (
          <img
            src={photo.thumbnailUrl}
            alt={photo.filename}
            style={{ ...photoImg, WebkitUserDrag: 'none', userSelect: 'none' } as React.CSSProperties}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div style={photoBroken}>—</div>
        )}
        {!readOnly && (
          <button
            style={{
              ...photoActionBtn,
              background: action === 'remove' ? '#EF4444' : C.brand,
              opacity: pending ? 0.5 : 1,
              cursor: pending ? 'progress' : 'pointer',
            }}
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              if (pending) return;
              onAction();
            }}
            aria-label={actionLabel}
            title={actionLabel}
          >
            {action === 'remove' ? <X size={13} /> : <Star size={13} />}
          </button>
        )}
        {pending && (
          <div style={photoPendingOverlay}>
            <Loader2 size={22} color={C.brand} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
      </div>
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
const hint: React.CSSProperties = { fontSize: 13, color: C.muted, marginBottom: 12 };
const totalsLine: React.CSSProperties = { fontSize: 12, color: C.muted, marginBottom: 16 };
const reportBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: C.brand, color: '#fff',
  borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, userSelect: 'none',
  flexShrink: 0,
};
const stepsWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24 };
const stepGroup: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', overflow: 'hidden',
};
const stepGroupHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px',
  background: '#EFF5EF', border: 'none', borderLeft: `4px solid ${C.brand}`, cursor: 'pointer',
  color: '#111827',
};
const stepGroupTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: '#111827', flex: 1, textAlign: 'left',
};
const stepGroupCount: React.CSSProperties = { fontSize: 12, color: C.muted, flexShrink: 0 };
const stepGroupBody: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 16, padding: 16,
};
const subGroupBlock: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10,
};
const subGroupTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: C.brand, textTransform: 'uppercase', letterSpacing: 0.3,
  borderBottom: `1px solid ${C.border}`, paddingBottom: 4,
};
const subGroupItems: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12,
};
const itemCard: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, background: '#fff',
  transition: 'border-color 0.15s, background 0.15s',
};
const itemDropActiveStyle: React.CSSProperties = {
  borderColor: C.brand, background: 'rgba(90,143,90,0.06)', boxShadow: `0 0 0 2px ${C.brand} inset`,
};
const itemRowHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap',
};
const itemTypeChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
  color: C.brand, background: '#EFF5EF', borderRadius: 6, padding: '2px 7px',
  textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0,
};
const itemRowTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0, flex: 1 };
const itemRowCount: React.CSSProperties = { fontSize: 12, color: C.muted, flexShrink: 0 };
const stateBadge: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
  borderRadius: 6, padding: '3px 9px', flexShrink: 0,
};
const emptyItem: React.CSSProperties = { fontSize: 13, color: C.muted, padding: '4px 0' };
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
const photoCardWrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0,
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
const photoPendingOverlay: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
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
