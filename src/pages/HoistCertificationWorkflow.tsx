import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Star,
  Upload,
  X,
  Download,
  Check,
  Ruler,
  Camera,
  CircleCheck,
  CircleX,
  CircleDashed,
  RotateCcw,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/organisms/ConfirmDialog';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import { useAuth } from '@/hooks/useAuth';
import {
  useHoistCampaignDetail,
  useHoistTree,
  useSetHoistPhotoSelected,
  useMoveHoistPhoto,
  useReorderHoistReportPhotos,
  useUpdateHoistStatus,
  useUploadHoistPhoto,
  useSetHoistItemValue,
} from '@/hooks/useHoistCertification';
import { generateAndDownloadHoistCertificationReport } from '@/services/hoistCertificationReportPdf.service';
import { getHoistLabel, HOIST_CERT_BY_CODE } from '@/constants/hoist-certification-steps';
import { byReportOrder } from '@/utils/reportOrder';
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
  const reorderReport = useReorderHoistReportPhotos(campaignId);
  const updateStatus = useUpdateHoistStatus(campaignId);
  const uploadPhoto = useUploadHoistPhoto(campaignId);
  const [confirmReopen, setConfirmReopen] = useState(false);

  // Lightbox holds the id of the photo being previewed (not a snapshot) so it
  // always reflects the fresh tree. Same as RepairWorkflow.
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
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

  // Persist the dragged order of the photos selected for the report (inside an
  // item). Read-only for client. The optimistic update lives in the hook.
  const handleReorderSelected = (orderedIds: string[]) => {
    if (isClient) return;
    reorderReport.mutate(
      { orderedIds },
      { onError: (err) => toast.error((err as Error)?.message || t('hoist.reorderError')) },
    );
  };

  const handlePreview = (photo: HoistPhoto) => {
    if (photo.url) setLightboxPhotoId(photo.id);
  };

  // Upload one or more image files (dropped from the OS or picked via the
  // hidden input) into a SPECIFIC item. Read-only for the client (RLS also
  // blocks the write). Sequential, one toast per file, same as
  // RepairWorkflow.handleUploadPhotos.
  const handleUploadPhotos = async (
    files: File[],
    target: { itemId: string | null; itemCode: string },
  ): Promise<void> => {
    if (isClient || files.length === 0) return;
    for (const file of files) {
      try {
        await uploadPhoto.mutateAsync({ file, itemId: target.itemId, itemCode: target.itemCode });
        toast.success(t('hoist.uploadPhotoSuccess'));
      } catch (err) {
        toast.error((err as Error)?.message || t('hoist.uploadPhotoError'));
      }
    }
  };

  // Resolve the previewed photo and its same-item siblings from the LIVE tree,
  // ordered by captureOrder (same rule as RepairWorkflow's lightboxCtx).
  const lightboxCtx = useMemo(() => {
    if (!lightboxPhotoId || !tree) return null;
    for (const step of tree) {
      for (const item of stepItems(step)) {
        const match = item.photos.find((p) => p.id === lightboxPhotoId);
        if (match) {
          const siblings = item.photos
            .filter((p) => !!p.url)
            .slice()
            .sort((a, b) => a.captureOrder - b.captureOrder);
          const index = siblings.findIndex((p) => p.id === lightboxPhotoId);
          return { photo: match, siblings, index };
        }
      }
    }
    return null;
  }, [lightboxPhotoId, tree]);

  const lightbox = lightboxCtx?.photo ?? null;

  // Navigate to the previous/next photo of the same item (loops at the edges).
  const handleLightboxNav = (dir: -1 | 1) => {
    if (!lightboxCtx || lightboxCtx.siblings.length < 2) return;
    const n = lightboxCtx.siblings.length;
    const nextIdx = (lightboxCtx.index + dir + n) % n;
    setLightboxPhotoId(lightboxCtx.siblings[nextIdx]!.id);
  };

  // Keyboard: ←/→ navigate, Esc closes. Only while the lightbox is open.
  useEffect(() => {
    if (!lightboxCtx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxPhotoId(null);
      else if (e.key === 'ArrowLeft') handleLightboxNav(-1);
      else if (e.key === 'ArrowRight') handleLightboxNav(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxCtx]);

  // Reopen a FINISHED certification: back to 'hoist_in_progress' so the
  // technician sees it again in the mobile app. Only meaningful when the
  // certification is done; read-only for client.
  const isDone = campaign?.status === 'hoist_done';
  const canReopen = !isClient && isDone && !updateStatus.isPending;
  const handleReopen = () => {
    setConfirmReopen(false);
    updateStatus.mutate('hoist_in_progress', {
      onSuccess: () => toast.success(t('hoist.reopenSuccess')),
      onError: (err) => toast.error((err as Error)?.message || t('hoist.reopenError')),
    });
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
            <h1 style={title}>
              {t('hoist.workflowTitle')}
              {campaign?.status && (
                <span style={{ ...statusChip, ...(STATUS_CHIP[campaign.status] ?? {}) }}>
                  {t(STATUS_KEY[campaign.status] ?? 'hoist.statusOpen')}
                </span>
              )}
            </h1>
            <p style={subtitle}>
              {campaign?.turbineName ?? '—'}
              {campaign?.windFarmName ? ` · ${campaign.windFarmName}` : ''}
            </p>
          </div>
          <div style={headerActions}>
          {!isClient && (
            <button
              type="button"
              style={{
                ...reopenBtn,
                opacity: canReopen ? 1 : 0.5,
                cursor: canReopen ? 'pointer' : 'not-allowed',
              }}
              disabled={!canReopen}
              onClick={() => setConfirmReopen(true)}
              title={isDone ? t('hoist.reopenHint') : t('hoist.reopenOnlyDone')}
            >
              {updateStatus.isPending ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <RotateCcw size={14} />
              )}
              {t('hoist.reopen')}
            </button>
          )}
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
      </div>
      <ConfirmDialog
        open={confirmReopen}
        title={t('hoist.reopenTitle')}
        message={t('hoist.reopenMessage')}
        confirmLabel={t('hoist.reopen')}
        cancelLabel={t('button.cancel')}
        onConfirm={handleReopen}
        onCancel={() => setConfirmReopen(false)}
      />

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
                onUploadPhoto={isClient ? undefined : handleUploadPhotos}
                onReorderSelected={isClient ? undefined : handleReorderSelected}
                onPreview={handlePreview}
              />
            ))}
          </div>
        </>
      )}

      {/* Lightbox: enlarged photo preview */}
      {lightbox && lightboxCtx && (
        <div
          style={lightboxOverlay}
          onClick={() => setLightboxPhotoId(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* Top-right controls: star (select for report) + close */}
          {!isClient && (
            <button
              style={{
                ...lightboxStar,
                background: lightbox.hoistSelected ? C.brand : 'rgba(255,255,255,0.15)',
                cursor: pendingPhotoIds.has(lightbox.id) ? 'progress' : 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(lightbox, !lightbox.hoistSelected);
              }}
              aria-label={t('hoist.selectedForReport')}
              aria-pressed={lightbox.hoistSelected}
              title={t('hoist.selectedForReport')}
            >
              <Star size={20} color="#fff" fill={lightbox.hoistSelected ? '#fff' : 'none'} />
            </button>
          )}
          <button style={lightboxClose} onClick={() => setLightboxPhotoId(null)} aria-label={t('general.close')}>
            <X size={22} />
          </button>

          {/* Navigation arrows — only within the same item, ≥2 photos */}
          {lightboxCtx.siblings.length > 1 && (
            <>
              <button
                style={{ ...lightboxNav, left: 16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLightboxNav(-1);
                }}
                aria-label={t('general.previous')}
              >
                <ChevronLeft size={28} />
              </button>
              <button
                style={{ ...lightboxNav, right: 16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLightboxNav(1);
                }}
                aria-label={t('general.next')}
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

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
  if (step.hasGroups) return [...step.items, ...step.groups.flatMap((g) => g.items)];
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
  /** Upload image files into a specific item (undefined = read-only client). */
  onUploadPhoto?: UploadToItem;
  /** Persist the dragged order of the selected-for-report photos (undefined = read-only). */
  onReorderSelected?: (orderedIds: string[]) => void;
  onPreview: (photo: HoistPhoto) => void;
}

type UploadToItem = (
  files: File[],
  target: { itemId: string | null; itemCode: string },
) => Promise<void>;

// True when the drag in flight carries OS files (a file drag from the laptop),
// as opposed to an internal photo-card drag. Same as RepairWorkflow.isFileDrag.
function isFileDrag(e: React.DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
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
  onUploadPhoto,
  onReorderSelected,
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
      onUploadPhoto={onUploadPhoto}
      onReorderSelected={onReorderSelected}
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
            <>
              {/* Items hanging directly from the step go first, before the sub-groups. */}
              {step.items.length > 0 && (
                <div style={subGroupItems}>{step.items.map(renderItem)}</div>
              )}
              {step.groups.map((group: HoistGroupNode) => (
                <div key={group.groupCode} style={subGroupBlock}>
                  <div style={subGroupTitle}>{getHoistLabel(group.groupCode, locale)}</div>
                  <div style={subGroupItems}>{group.items.map(renderItem)}</div>
                </div>
              ))}
            </>
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
  /** Upload image files into THIS item (undefined = read-only client). */
  onUploadPhoto?: UploadToItem;
  /** Persist the dragged order of the selected-for-report photos (undefined = read-only). */
  onReorderSelected?: (orderedIds: string[]) => void;
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
  onUploadPhoto,
  onReorderSelected,
  onPreview,
  hoverTargetKey,
  setHoverTargetKey,
}: ItemRowProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  // Selected-for-report card currently hovered while reordering by drag.
  const [overId, setOverId] = useState<string | null>(null);
  // File-upload drop highlight (OS file drag over this item) + in-flight state.
  const [fileDropActive, setFileDropActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thisKey = item.itemId ?? item.itemCode;
  // Photo/measurement items always show their gallery. A 'check' item shows it
  // only when photos were captured (e.g. items that were 'photo' before becoming
  // 'check'), so already-uploaded photos never disappear from the screen.
  // Web-editable items carry a value from the app (a text box here); their
  // gallery only shows when the app actually sent photos.
  const isWebEditable = !!HOIST_CERT_BY_CODE[item.itemCode]?.webEditable;
  const hasPhotos = (item.itemType !== 'check' && !isWebEditable) || item.photos.length > 0;
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
  const selected = photos.filter((p) => p.hoistSelected).sort(byReportOrder);

  // A photo-bearing item can RECEIVE a moved photo whenever writable.
  const canReceiveMove = hasPhotos && !readOnly && !!onMovePhoto;

  // A photo-bearing item can RECEIVE an UPLOAD (drop files from disk / "+"
  // button) when writable. Pure 'check' items without photos show no gallery,
  // so they don't take uploads (same rule as receiving a moved photo).
  const canUpload = hasPhotos && !readOnly && !!onUploadPhoto;

  // Run the upload for a batch of files, scoping the spinner to THIS item.
  const runUpload = async (files: File[]) => {
    if (!canUpload || !onUploadPhoto || files.length === 0) return;
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setUploading(true);
    try {
      await onUploadPhoto(images, { itemId: item.itemId, itemCode: item.itemCode });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) void runUpload(Array.from(files));
    // Reset so the same file can be re-selected.
    e.target.value = '';
  };

  // Enable the drag handlers when EITHER move or upload is possible.
  const dragEnabled = canReceiveMove || canUpload;

  const isForeignDrag = (e: React.DragEvent) => {
    const origin = activeDragOriginItemCode ?? e.dataTransfer.getData(ITEM_MIME);
    return origin !== item.itemCode;
  };

  // ── Reorder the selected-for-report photos by dragging (same item) ──────────
  const canReorder = hasPhotos && !readOnly && !!onReorderSelected;
  const isReorderDrag = (e: React.DragEvent) =>
    canReorder && !!dragId && selected.some((p) => p.id === dragId) && !isForeignDrag(e);
  const endDrag = () => {
    setDragId(null);
    setOverId(null);
  };
  const handleCardDragOver = (e: React.DragEvent, targetId: string) => {
    // Not a reorder (e.g. a photo from the left column) → bubble to the column.
    if (!isReorderDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (overId !== targetId) setOverId(targetId);
  };
  const handleCardDrop = (e: React.DragEvent, targetId: string) => {
    if (!isReorderDrag(e) || !dragId || !onReorderSelected) return;
    e.preventDefault();
    e.stopPropagation();
    const ids = selected.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    endDrag();
    if (from < 0 || to < 0 || from === to) return;
    // The dragged photo takes the position of the one it was dropped on.
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    onReorderSelected(ids);
  };
  const TypeIcon =
    item.itemType === 'check' ? Check : item.itemType === 'measurement' ? Ruler : Camera;

  return (
    <div
      style={{
        ...itemCard,
        ...(itemDropActive ? itemDropActiveStyle : {}),
        ...(fileDropActive ? itemDropActiveStyle : {}),
      }}
      onDragOver={
        dragEnabled
          ? (e) => {
              // OS file drags (upload) take priority over internal photo moves.
              if (canUpload && isFileDrag(e)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setFileDropActive(true);
                return;
              }
              if (!canReceiveMove) return;
              if (!isForeignDrag(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setHoverTargetKey(thisKey);
            }
          : undefined
      }
      // onDragLeave only clears the FILE-upload highlight; the move highlight
      // is never cleared here (same reasoning as RepairWorkflow StageRow).
      onDragLeave={
        canUpload
          ? (e) => {
              const related = e.relatedTarget as Node | null;
              if (!related || !e.currentTarget.contains(related)) setFileDropActive(false);
            }
          : undefined
      }
      onDrop={
        dragEnabled
          ? (e) => {
              // OS file drop → upload into this item.
              if (canUpload && isFileDrag(e)) {
                e.preventDefault();
                setFileDropActive(false);
                const files = e.dataTransfer.files;
                if (files && files.length > 0) void runUpload(Array.from(files));
                return;
              }
              if (!canReceiveMove) return;
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
        {item.itemType === 'measurement' &&
          (isWebEditable && !readOnly ? (
            <EditableValue itemCode={item.itemCode} value={item.measurementValue} t={t} />
          ) : (
            <MeasurementBadge value={item.measurementValue} unit={item.measurementUnit} t={t} />
          ))}
        {hasPhotos && (
          <span style={itemRowCount}>
            {photos.length} {t('hoist.photos')} · {selected.length} {t('hoist.selected')}
          </span>
        )}
        {/* "Add photo" button + hidden input — alternative to drag&drop. */}
        {canUpload && (
          <>
            <button
              type="button"
              style={itemAddBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={t('hoist.addPhoto')}
            >
              {uploading ? (
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Plus size={13} />
              )}
              {t('hoist.addPhoto')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={handleFileInput}
              style={{ display: 'none' }}
              aria-label={t('hoist.addPhoto')}
            />
          </>
        )}
      </div>

      {/* File-drop hint: visible while an OS file drag hovers this item, or a
          subtle persistent dropzone affordance when the item is empty. */}
      {canUpload && (fileDropActive || photos.length === 0) && (
        <div style={{ ...itemDropHint, ...(fileDropActive ? itemDropHintActive : {}) }}>
          <Upload size={15} />
          <span>{uploading ? t('hoist.uploading') : t('hoist.dropToUpload')}</span>
        </div>
      )}

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
                    onDragEnd={endDrag}
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
                    onDragEnd={endDrag}
                    action="remove"
                    actionLabel={t('hoist.remove')}
                    onAction={() => onSelect(photo, false)}
                    onPreview={() => onPreview(photo)}
                    selected
                    dropOver={overId === photo.id && dragId !== photo.id}
                    onCardDragOver={canReorder ? (e) => handleCardDragOver(e, photo.id) : undefined}
                    onCardDrop={canReorder ? (e) => handleCardDrop(e, photo.id) : undefined}
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

/**
 * Text box for web-editable items: shows the value sent by the app and lets the
 * user correct it before generating the report. Saves on blur or Enter, only
 * when the text changed; an empty box clears the value.
 */
function EditableValue({
  itemCode,
  value,
  t,
}: {
  itemCode: string;
  value: number | string | null;
  t: (k: string) => string;
}) {
  const { campaignId } = useParams();
  const toast = useToast();
  const setValue = useSetHoistItemValue(campaignId);
  const saved = value === null || value === undefined ? '' : String(value);
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  const commit = () => {
    if (text.trim() === saved.trim()) return;
    setValue.mutate(
      { itemCode, value: text },
      {
        onSuccess: () => toast.success(t('hoist.valueSaved')),
        onError: (err) => {
          setText(saved);
          toast.error((err as Error)?.message || t('hoist.valueError'));
        },
      },
    );
  };
  return (
    <input
      type="text"
      aria-label={t('hoist.editValue')}
      title={t('hoist.editValue')}
      placeholder={t('hoist.noData')}
      value={text}
      disabled={setValue.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setText(saved);
      }}
      style={valueInput}
    />
  );
}

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
  /** Highlight as the reorder drop target (selected-for-report column). */
  dropOver?: boolean;
  onCardDragOver?: (e: React.DragEvent) => void;
  onCardDrop?: (e: React.DragEvent) => void;
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
  dropOver,
  onCardDragOver,
  onCardDrop,
}: PhotoCardProps) {
  const { t } = useLanguage();
  const uploaderLabel = `${t('hoist.uploadedByShort')}: ${photo.uploadedBy ?? '—'}`;
  const interactive = !readOnly && !pending;
  return (
    <div
      style={{
        ...photoCardWrap,
        ...(dropOver ? { outline: `2px dashed ${C.brand}`, outlineOffset: 2, borderRadius: 8 } : {}),
      }}
      onDragOver={onCardDragOver}
      onDrop={onCardDrop}
    >
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
      {/* Uploader label: who uploaded this photo (sits below the image). */}
      <span style={photoUploader} title={uploaderLabel}>{uploaderLabel}</span>
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
const valueInput: React.CSSProperties = {
  width: 180, padding: '4px 8px', fontSize: 12, borderRadius: 6,
  border: `1px solid ${C.border}`, background: '#fff', color: '#1a1a1a',
};
const headerActions: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0,
};
const reopenBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: C.brand,
  border: `1px solid ${C.brand}`, borderRadius: 8, padding: '7px 14px', fontSize: 12,
  fontWeight: 600, userSelect: 'none',
};
const statusChip: React.CSSProperties = {
  marginLeft: 10, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
  verticalAlign: 'middle',
};
// Same colors as the campaign list badges (CampaignAccordion.getHoistStatusBadge).
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
const photoUploader: React.CSSProperties = {
  fontSize: 11, color: C.muted, lineHeight: 1.3,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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
const lightboxStar: React.CSSProperties = {
  position: 'fixed', top: 20, right: 72, width: 40, height: 40, borderRadius: '50%',
  border: 'none', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const lightboxNav: React.CSSProperties = {
  position: 'fixed', top: '50%', transform: 'translateY(-50%)',
  width: 48, height: 48, borderRadius: '50%',
  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
};
// "Add photo" button in the item header (upload alternative to drag&drop).
const itemAddBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: C.brand, color: '#fff',
  border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', flexShrink: 0,
};
// Dashed hint shown when a file drag hovers the item or the item is empty.
const itemDropHint: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  border: `2px dashed ${C.border}`, borderRadius: 10, padding: '14px 10px',
  color: C.muted, fontSize: 12, fontWeight: 600, marginBottom: 10,
  transition: 'border-color 0.15s, background 0.15s, color 0.15s',
};
const itemDropHintActive: React.CSSProperties = {
  borderColor: C.brand, background: 'rgba(90,143,90,0.08)', color: C.brand,
};
