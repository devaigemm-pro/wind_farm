import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Star, X, Download } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import { useAuth } from '@/hooks/useAuth';
import {
  useCleaningCampaignDetail,
  useCleaningTree,
  useSetCleaningPhotoSelected,
  useMovePhotoToZone,
} from '@/hooks/useCleaning';
import { generateAndDownloadCleaningReport } from '@/services/cleaningReportPdf.service';
import { getCleaningZoneLabel } from '@/constants/cleaning-zones';
import type { CleaningPhoto, CleaningZoneNode } from '@/services/cleaning.service';

const C = {
  brand: '#5A8F5A',
  text: '#535353',
  muted: '#8A9099',
  border: '#E5E7EB',
};

export function CleaningWorkflow() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const { role } = useAuth();
  // client can view photos and generate/download reports, but cannot select or
  // move photos (read-only selection). RLS also blocks the write.
  const isClient = role === 'client';

  const { data: campaign, isLoading: campaignLoading } = useCleaningCampaignDetail(campaignId);
  const { data: tree, isLoading: treeLoading } = useCleaningTree(campaignId);
  const setSelected = useSetCleaningPhotoSelected(campaignId);
  const movePhoto = useMovePhotoToZone(campaignId);

  const [lightbox, setLightbox] = useState<CleaningPhoto | null>(null);
  // Photo ids whose selection mutation is in flight → per-photo spinner.
  const [pendingPhotoIds, setPendingPhotoIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const handleSelect = (photo: CleaningPhoto, selected: boolean) => {
    if (isClient) return;
    if (photo.cleaningSelected === selected) return;
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

  // Move a photo to another zone/sub-zone (fixing a wrong-zone upload).
  const handleMovePhoto = (
    photoId: string,
    originZoneCode: string,
    targetZoneId: string | null,
    targetZoneCode: string,
  ) => {
    if (isClient) return;
    if (originZoneCode === targetZoneCode) return;
    setPendingPhotoIds((prev) => new Set(prev).add(photoId));
    movePhoto.mutate(
      { photoId, targetZoneId, targetZoneCode },
      {
        onSuccess: () => toast.success(t('cleaning.movePhotoSuccess')),
        onError: (err) => toast.error((err as Error)?.message || t('cleaning.movePhotoError')),
        onSettled: () =>
          setPendingPhotoIds((prev) => {
            const next = new Set(prev);
            next.delete(photoId);
            return next;
          }),
      },
    );
  };

  const handlePreview = (photo: CleaningPhoto) => {
    if (photo.url) setLightbox(photo);
  };

  const handleGenerateReport = async () => {
    if (!campaignId || downloading) return;
    setDownloading(true);
    try {
      await generateAndDownloadCleaningReport({ campaignId });
    } catch (err) {
      toast.error((err as Error)?.message || t('cleaning.pdfError'));
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
            <h1 style={title}>{t('cleaning.workflowTitle')}</h1>
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
            title={t('cleaning.generateReport')}
          >
            {downloading ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download size={14} />
            )}
            {t('cleaning.generateReport')}
          </span>
        </div>
      </div>

      <p style={hint}>{t('cleaning.workflowHint')}</p>

      {treeLoading ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('general.loading')}</p>
      ) : !tree || tree.length === 0 ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('cleaning.noZones')}</p>
      ) : (
        <>
          <p style={totalsLine}>
            {totalPhotos} {t('cleaning.photos')} · {selectedPhotos} {t('cleaning.selected')}
          </p>
          <div style={zonesWrap}>
            {tree.map((zone) => (
              <ZoneSection
                key={zone.zoneCode}
                zone={zone}
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

function countPhotos(tree: CleaningZoneNode[]): number {
  let n = 0;
  for (const z of tree) {
    n += z.photos.length;
    for (const c of z.children) n += c.photos.length;
  }
  return n;
}
function countSelected(tree: CleaningZoneNode[]): number {
  let n = 0;
  for (const z of tree) {
    n += z.photos.filter((p) => p.cleaningSelected).length;
    for (const c of z.children) n += c.photos.filter((p) => p.cleaningSelected).length;
  }
  return n;
}

// ─── Zone section (level 1, collapsible) — owns the shared move highlight ───────

interface ZoneSectionProps {
  zone: CleaningZoneNode;
  locale: 'es' | 'en';
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: CleaningPhoto, selected: boolean) => void;
  /** Move a photo to another zone/sub-zone (undefined = read-only client). */
  onMovePhoto?: (
    photoId: string,
    originZoneCode: string,
    targetZoneId: string | null,
    targetZoneCode: string,
  ) => void;
  onPreview: (photo: CleaningPhoto) => void;
}

/**
 * A collapsible ROOT zone (Palas / Nacelle / Hub / Torre). Container roots
 * (Palas / Nacelle) render their sub-zones as drop-target rows; leaf roots
 * (Hub / Torre) render a single drop-target row for their own photos.
 *
 * This component owns the cross-zone move highlight as a SINGLE shared state
 * (`hoverTargetZoneId`) — exactly like StagesList in RepairWorkflow — so a
 * single reset clears every sub-zone at once. There is NO fragile onDragLeave:
 * every dragOver REASSIGNS the shared target to the sub-zone under the pointer,
 * and the reset happens on drop/dragend (one document-level listener mounted
 * once here). This guarantees exactly one highlighted sub-zone at a time with
 * no residual borders.
 */
function ZoneSection({
  zone,
  locale,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onMovePhoto,
  onPreview,
}: ZoneSectionProps) {
  const [open, setOpen] = useState(false);
  // Which sub-zone is currently hovered as the target of a cross-zone move
  // (null = none). Shared by every ZoneRow of this zone. For catalog-fallback
  // leaves (zoneId null) the shared key is the zoneCode instead.
  const [hoverTargetKey, setHoverTargetKey] = useState<string | null>(null);

  // Single global drag-end safety net for the WHOLE zone: whenever any HTML5
  // drag finishes (drop OR cancel), clear the shared highlight. Mounted once —
  // not per ZoneRow — so there's exactly one reset and no race between
  // listeners/states. `drop` is covered too because some browsers skip
  // `dragend` on a source whose DOM node was removed by the optimistic
  // re-render. Mirrors StagesList in RepairWorkflow.
  useEffect(() => {
    const clear = () => setHoverTargetKey(null);
    document.addEventListener('dragend', clear);
    document.addEventListener('drop', clear);
    return () => {
      document.removeEventListener('dragend', clear);
      document.removeEventListener('drop', clear);
    };
  }, []);

  const label = getCleaningZoneLabel(zone.zoneCode, locale);
  // Rows = sub-zones for a container; the zone itself for a leaf root.
  const rows = zone.isLeaf ? [zone] : zone.children;
  const zonePhotoCount = rows.reduce((acc, r) => acc + r.photos.length, 0);
  const zoneSelectedCount = rows.reduce(
    (acc, r) => acc + r.photos.filter((p) => p.cleaningSelected).length,
    0,
  );

  return (
    <div style={zoneGroup}>
      <button style={zoneGroupHeader} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <span style={zoneGroupTitle}>{label}</span>
        <span style={zoneGroupCount}>
          {zonePhotoCount} {t('cleaning.photos')} · {zoneSelectedCount} {t('cleaning.selected')}
        </span>
      </button>

      {open && (
        <div style={zoneGroupBody}>
          {rows.map((row) => (
            <ZoneRow
              key={row.zoneId ?? row.zoneCode}
              zone={row}
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
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Zone row (level 2, with drag&drop) ─────────────────────────────────────────

interface ZoneRowProps {
  zone: CleaningZoneNode;
  locale: 'es' | 'en';
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: CleaningPhoto, selected: boolean) => void;
  onMovePhoto?: (
    photoId: string,
    originZoneCode: string,
    targetZoneId: string | null,
    targetZoneCode: string,
  ) => void;
  onPreview: (photo: CleaningPhoto) => void;
  /** Key of the sub-zone currently hovered as a cross-zone move target (shared
      by all ZoneRows of the zone). This row is highlighted when it equals its
      own key. */
  hoverTargetKey: string | null;
  /** Setter for the shared hover target. */
  setHoverTargetKey: (key: string | null) => void;
}

// Custom dataTransfer MIME carrying the ORIGIN zone code of the dragged photo.
// Lets a drop target tell "move to another zone" (origin != this zone) apart
// from "select within the same zone" (origin == this zone).
const ZONE_MIME = 'application/x-zone-code';

// Origin zone code of the drag currently in flight. dataTransfer.getData() is
// NOT readable during `dragover` in most browsers (only on `drop`), so the drop
// zones use this module-level value (set on dragStart, read synchronously on
// dragover) to distinguish a cross-zone move from a same-zone selection. Safe
// as a singleton because only one HTML5 drag can be in flight at a time.
let activeDragOriginZoneCode: string | null = null;

function ZoneRow({
  zone,
  locale,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onMovePhoto,
  onPreview,
  hoverTargetKey,
  setHoverTargetKey,
}: ZoneRowProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  // This row's stable shared key (zoneId when present, else zoneCode).
  const thisKey = zone.zoneId ?? zone.zoneCode;
  // Cross-zone move highlight derived from the SHARED hover target (not a local
  // boolean) so a single upstream reset clears every row at once. No per-row
  // dragend listener needed for this highlight.
  const zoneDropActive = hoverTargetKey != null && hoverTargetKey === thisKey;

  // Safety net for the same-zone selection-column highlight (`dropActive`): a
  // cancelled drag may skip the leave; a single dragend reset guarantees it
  // never sticks. (The cross-zone highlight is handled upstream by the shared
  // state, so it is NOT touched here.)
  useEffect(() => {
    const clear = () => setDropActive(false);
    document.addEventListener('dragend', clear);
    document.addEventListener('drop', clear);
    return () => {
      document.removeEventListener('dragend', clear);
      document.removeEventListener('drop', clear);
    };
  }, []);

  const photos = zone.photos;
  const available = photos.filter((p) => !p.cleaningSelected);
  const selected = photos.filter((p) => p.cleaningSelected);

  // This zone can RECEIVE a moved photo whenever writable (leaf zones always
  // accept; a target without a zoneId still works — movePhotoToZone passes null
  // and the tree regroups by zone_code).
  const canReceiveMove = !readOnly && !!onMovePhoto;

  // True when the in-flight drag started in a DIFFERENT zone than this one.
  const isForeignDrag = (e: React.DragEvent) => {
    const origin = activeDragOriginZoneCode ?? e.dataTransfer.getData(ZONE_MIME);
    return origin !== zone.zoneCode;
  };

  return (
    <div
      style={{ ...zoneCard, ...(zoneDropActive ? zoneDropActiveStyle : {}) }}
      onDragOver={
        canReceiveMove
          ? (e) => {
              if (!isForeignDrag(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              // Point the SHARED hover target at this row. Reassigning on every
              // dragOver guarantees only one row is highlighted at a time.
              setHoverTargetKey(thisKey);
            }
          : undefined
      }
      // No onDragLeave on purpose (same reasoning as RepairWorkflow StageRow):
      // per-row dragLeave is unreliable with fast moves across adjacent cards.
      // Every dragOver reassigns the single shared target; the final reset
      // happens on drop/dragend (ZoneSection safety net).
      onDrop={
        canReceiveMove
          ? (e) => {
              const origin =
                e.dataTransfer.getData(ZONE_MIME) || (activeDragOriginZoneCode ?? '');
              // Same-zone drop → let the inner "selected" column handle it.
              if (origin === zone.zoneCode) return;
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain') || dragId;
              // The dragged photo belongs to another zone, so it won't be in
              // this zone's photos; the move proceeds using the id + origin
              // code (resolved from the drag payload / module tracker).
              if (id && onMovePhoto) {
                onMovePhoto(id, origin, zone.zoneId, zone.zoneCode);
              }
              // Reset the shared highlight LAST and unconditionally. Because it's
              // a single shared value, this clears the destination row too even
              // though onMovePhoto just triggered an optimistic re-render.
              setHoverTargetKey(null);
            }
          : undefined
      }
    >
      <div style={zoneRowHeader}>
        <h3 style={zoneRowTitle}>{getCleaningZoneLabel(zone.zoneCode, locale)}</h3>
        <span style={zoneRowCount}>
          {photos.length} {t('cleaning.photos')} · {selected.length} {t('cleaning.selected')}
        </span>
      </div>

      {photos.length === 0 ? (
        <p style={emptyZone}>{t('cleaning.noPhotosZone')}</p>
      ) : (
        <div style={columns}>
          {/* Left: all photos of the zone (drag source) */}
          <div style={col}>
            <div style={colTitle}>{t('cleaning.allPhotos')}</div>
            <div style={grid}>
              {available.length === 0 ? (
                <p style={colEmpty}>{t('cleaning.allSelectedZone')}</p>
              ) : (
                available.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    originZoneCode={zone.zoneCode}
                    dimmed={dragId === photo.id}
                    pending={pendingPhotoIds.has(photo.id)}
                    readOnly={readOnly}
                    onDragStart={() => setDragId(photo.id)}
                    onDragEnd={() => setDragId(null)}
                    action="add"
                    actionLabel={t('cleaning.select')}
                    onAction={() => onSelect(photo, true)}
                    onPreview={() => onPreview(photo)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: selected photos (drop zone). Handles ONLY same-zone
              selection. A photo dragged from ANOTHER zone bubbles up to the
              zone-level move drop zone. */}
          <div
            style={{ ...col, ...(dropActive ? colDropActive : {}) }}
            onDragOver={
              readOnly
                ? undefined
                : (e) => {
                    if (isForeignDrag(e)) return; // foreign → bubble to move zone
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
                    if (isForeignDrag(e)) return; // handled by zone-level drop
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
              <Star size={13} color={C.brand} /> {t('cleaning.selectedForReport')}
            </div>
            <div style={grid}>
              {selected.length === 0 ? (
                <p style={dropPlaceholder}>{t('cleaning.dropHere')}</p>
              ) : (
                selected.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    originZoneCode={zone.zoneCode}
                    dimmed={dragId === photo.id}
                    pending={pendingPhotoIds.has(photo.id)}
                    readOnly={readOnly}
                    onDragStart={() => setDragId(photo.id)}
                    onDragEnd={() => setDragId(null)}
                    action="remove"
                    actionLabel={t('cleaning.remove')}
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
  photo: CleaningPhoto;
  /** Origin zone code of this photo. Written to the drag payload so a drop
      target can tell move-across-zone apart from select-within-zone. */
  originZoneCode: string;
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
  originZoneCode,
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
  // While pending, block drag + action to avoid a double-fire on the same photo.
  const interactive = !readOnly && !pending;
  return (
    <div style={photoCardWrap}>
      <div
        draggable={interactive}
        onDragStart={
          interactive
            ? (e) => {
                e.dataTransfer.setData('text/plain', photo.id);
                e.dataTransfer.setData(ZONE_MIME, originZoneCode);
                activeDragOriginZoneCode = originZoneCode;
                e.dataTransfer.effectAllowed = 'move';
                onDragStart();
              }
            : undefined
        }
        onDragEnd={
          interactive
            ? () => {
                activeDragOriginZoneCode = null;
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
const zonesWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24 };
const zoneGroup: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', overflow: 'hidden',
};
const zoneGroupHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px',
  background: '#EFF5EF', border: 'none', borderLeft: '4px solid #5A8F5A', cursor: 'pointer',
  color: '#111827',
};
const zoneGroupTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: '#111827', flex: 1, textAlign: 'left',
};
const zoneGroupCount: React.CSSProperties = { fontSize: 12, color: C.muted, flexShrink: 0 };
const zoneGroupBody: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
};
const zoneCard: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, background: '#fff',
  transition: 'border-color 0.15s, background 0.15s',
};
// Zone-level drop highlight when a photo from ANOTHER zone is dragged over this
// zone card (mirrors colDropActive used by the intra-zone selection).
const zoneDropActiveStyle: React.CSSProperties = {
  borderColor: C.brand, background: 'rgba(90,143,90,0.06)', boxShadow: `0 0 0 2px ${C.brand} inset`,
};
const zoneRowHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };
const zoneRowTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0, flex: 1 };
const zoneRowCount: React.CSSProperties = { fontSize: 12, color: C.muted };
const emptyZone: React.CSSProperties = { fontSize: 13, color: C.muted, padding: '4px 0' };
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
