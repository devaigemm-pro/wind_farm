import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Pencil, Plus, RotateCcw, Star, Trash2, Upload, X } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import { useAuth } from '@/hooks/useAuth';
import { useAnnotationTypes } from '@/hooks/useAnnotationTypes';
import {
  useRepairCampaignDetail,
  useRepairTree,
  useSetPhotoSelected,
  useMovePhotoToStage,
  useUploadRepairPhoto,
  useDeleteRepairDefect,
  useUpdateDefectFields,
  useUpdateRepairProgress,
  useUpdateBladeColor,
  useReopenDefect,
  useTechnicians,
} from '@/hooks/useRepair';
import { parseCoatingMethod } from '@/utils/coatingMethod';
import {
  generateAndDownloadRepairReport,
  getRepairsWithReport,
  downloadPersistedRepairReport,
  persistRepairReport,
} from '@/services/repairReportPdf.service';
import type { RepairDefectNode, RepairPhoto, RepairStageNode, Technician } from '@/services/repair.service';

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

interface BladeGroup {
  position: number;
  label: string;
  /** Blade serial number shared by every defect of the blade (from the first node). */
  serial: string | null;
  nodes: RepairDefectNode[];
}

/**
 * Group defect nodes by blade (A/B/C), ordered by blade position, and within
 * each blade by the per-blade correlative (A1, A2, ...). Defects with an unknown
 * blade (position 0) are grouped last under "—".
 */
function groupDefectsByBlade(tree: RepairDefectNode[]): BladeGroup[] {
  const byPosition = new Map<number, RepairDefectNode[]>();
  for (const node of tree) {
    const pos = node.defect.bladePosition || 0;
    if (!byPosition.has(pos)) byPosition.set(pos, []);
    byPosition.get(pos)!.push(node);
  }
  const positions = [...byPosition.keys()].sort((a, b) => {
    // Known blades (1,2,3) first in order; unknown (0) last.
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });
  return positions.map((position) => {
    const nodes = byPosition.get(position)!.slice().sort((a, b) =>
      (a.defect.defectNumber ?? '').localeCompare(b.defect.defectNumber ?? '', undefined, {
        numeric: true,
      }),
    );
    // All defects of a blade share the same serial → take it from the first node.
    const serial = nodes[0]?.defect.bladeSerial ?? null;
    return { position, label: BLADE_LABELS[position] ?? '—', serial, nodes };
  });
}

export function RepairWorkflow() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const { role } = useAuth();
  // client can view photos and generate/download reports, but cannot select
  // or move photos (read-only selection). RLS also blocks the write.
  const isClient = role === 'client';

  const { data: campaign, isLoading: campaignLoading } = useRepairCampaignDetail(campaignId);
  const { data: tree, isLoading: treeLoading } = useRepairTree(campaignId);
  // Full list of annotation type names (~20) — matches the Excel importer and
  // the annotations. The defect_type_check constraint now accepts all of them.
  const { data: annotationTypes = [] } = useAnnotationTypes();
  const typeOptions = annotationTypes.map((at) => at.name);
  const setSelected = useSetPhotoSelected(campaignId);
  const movePhoto = useMovePhotoToStage(campaignId);
  const uploadPhoto = useUploadRepairPhoto(campaignId);
  const deleteDefect = useDeleteRepairDefect(campaignId);
  const updateDefectFields = useUpdateDefectFields(campaignId);
  const updateRepairProgress = useUpdateRepairProgress(campaignId);
  const updateBladeColor = useUpdateBladeColor(campaignId);
  const reopenDefect = useReopenDefect(campaignId);
  const { data: technicians = [] } = useTechnicians();

  // defectId currently being generated (null = none). Scopes the spinner to
  // the specific defect card whose report is being generated.
  const [downloadingDefectId, setDownloadingDefectId] = useState<string | null>(null);
  // Lightbox holds the id of the photo being previewed (not a snapshot) so it
  // always reflects the fresh tree — selection toggles update the star icon and
  // left/right navigation reads the live sibling list.
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  // Photo ids whose selection mutation is in flight → drives a per-photo spinner.
  // A Set handles several rapid clicks across different photos concurrently.
  const [pendingPhotoIds, setPendingPhotoIds] = useState<Set<string>>(new Set());
  // repair_ids that already have a persisted report (type='repair') in the DB.
  // Drives whether each defect shows "Download report" vs "Generate report".
  const [repairsWithReport, setRepairsWithReport] = useState<Set<string>>(new Set());

  // Whenever the tree loads/changes, refresh which repairs already have a report.
  useEffect(() => {
    if (!tree || tree.length === 0) {
      setRepairsWithReport(new Set());
      return;
    }
    let cancelled = false;
    const repairIds = tree
      .map((n) => n.repairId)
      .filter((id): id is string => Boolean(id));
    (async () => {
      const withReport = await getRepairsWithReport(repairIds);
      if (!cancelled) setRepairsWithReport(withReport);
    })();
    return () => { cancelled = true; };
  }, [tree]);

  // ── Coating method ("Color") — background OCR, ONCE per repair ──────────────
  // When the tree is loaded, resolve repair.blade_color for every repair that
  // doesn't have it yet, by running tesseract.js IN THE BROWSER (it has Web
  // Workers) against the FIRST-stage / FIRST-image photo. The result is cached
  // in the DB (repair.blade_color); the PDF report only READS it, never runs
  // OCR. This is fully decoupled from report generation and non-blocking:
  //   - runs in a background async loop (sequential, one repair at a time)
  //   - a ref-backed Set prevents re-dispatching the same repair in this mount
  //   - tesseract.js is imported DYNAMICALLY so it stays out of the initial bundle
  //   - wrapped in try/catch: a failure leaves blade_color null (retried later)
  //   - skipped entirely for client users (read-only; RLS would block the write)
  const ocrProcessedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isClient || !tree || tree.length === 0) return;

    // Candidate repairs: have a repairId, no blade_color yet, and a resolvable
    // first-stage/first-image photo URL.
    const pickFirstPhotoUrl = (node: RepairDefectNode): string | null => {
      const stagesWithPhotos = node.stages.filter((s) => s.photos.some((p) => !!p.url));
      if (stagesWithPhotos.length === 0) return null;
      // First stage = lowest sortOrder; image 1 = lowest captureOrder.
      const firstStage = stagesWithPhotos
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)[0]!;
      const firstPhoto = firstStage.photos
        .filter((p) => !!p.url)
        .slice()
        .sort((a, b) => a.captureOrder - b.captureOrder)[0];
      return firstPhoto?.url ?? null;
    };

    const candidates = tree
      .map((node) => {
        const repairId = node.repairId;
        if (!repairId) return null;
        if (node.bladeColor && node.bladeColor.trim()) return null; // already resolved
        if (ocrProcessedRef.current.has(repairId)) return null; // already attempted this mount
        const url = pickFirstPhotoUrl(node);
        if (!url) return null;
        return { repairId, url };
      })
      .filter((c): c is { repairId: string; url: string } => c != null);

    if (candidates.length === 0) return;

    let cancelled = false;
    (async () => {
      // Dynamic import so tesseract.js never inflates the initial bundle.
      // tesseract.js uses `export = Tesseract` (CJS), so under bundler module
      // resolution the namespace is surfaced on `.default` with a plain
      // namespace fallback.
      const mod = await import('tesseract.js');
      const Tesseract = (mod as unknown as { default?: typeof import('tesseract.js') }).default ?? mod;
      for (const { repairId, url } of candidates) {
        if (cancelled) return;
        // Mark as attempted up-front so a refetch mid-loop doesn't re-dispatch it.
        ocrProcessedRef.current.add(repairId);
        try {
          const result = await Tesseract.recognize(url, 'eng');
          const value = parseCoatingMethod(result?.data?.text ?? '');
          if (value && !cancelled) {
            // Persist + invalidate the tree so the report reads the cached value.
            await updateBladeColor.mutateAsync({ repairId, color: value });
          }
        } catch {
          // Leave blade_color null; a later visit (fresh mount) will retry.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run when the tree changes (e.g. after invalidation): the ref prevents
    // reprocessing repairs already attempted, and resolved ones are filtered out.
  }, [tree, isClient, updateBladeColor]);

  const handleSelect = (photo: RepairPhoto, selected: boolean) => {
    // client is read-only for selection.
    if (isClient) return;
    if (photo.repairSelected === selected) return;
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

  // Move a photo to another stage of the same defect (fixing a wrong-stage
  // upload). Read-only for client (RLS also blocks the write). Reuses the
  // per-photo pending spinner so the card shows progress while the move saves.
  const handleMovePhoto = (photo: RepairPhoto, targetStageId: string, targetStageCode: string) => {
    if (isClient) return;
    if (!targetStageId || photo.repairStageId === targetStageId) return;
    setPendingPhotoIds((prev) => new Set(prev).add(photo.id));
    movePhoto.mutate(
      { photoId: photo.id, targetStageId, targetStageCode },
      {
        onSuccess: () => toast.success(t('repair.movePhotoSuccess')),
        onError: (err) => toast.error((err as Error)?.message || t('repair.movePhotoError')),
        onSettled: () =>
          setPendingPhotoIds((prev) => {
            const next = new Set(prev);
            next.delete(photo.id);
            return next;
          }),
      },
    );
  };

  const handlePreview = (photo: RepairPhoto) => {
    if (photo.url) setLightboxPhotoId(photo.id);
  };

  // Upload one or more image files (dropped from the OS or picked via the
  // hidden input) into a SPECIFIC repair stage. Read-only for the client (RLS
  // also blocks the write). Each file is uploaded sequentially so a single
  // failure is reported without aborting the rest; the stage re-renders once
  // the tree invalidation lands. Returns a promise so the StageRow can show a
  // per-stage uploading spinner while it runs.
  const handleUploadPhotos = async (
    files: File[],
    target: { repairId: string; repairStageId: string; stageCode: string },
  ): Promise<void> => {
    if (isClient || files.length === 0) return;
    for (const file of files) {
      try {
        await uploadPhoto.mutateAsync({
          file,
          repairId: target.repairId,
          repairStageId: target.repairStageId,
          stageCode: target.stageCode,
        });
        toast.success(t('repair.uploadPhotoSuccess'));
      } catch (err) {
        toast.error((err as Error)?.message || t('repair.uploadPhotoError'));
      }
    }
  };

  // Resolve the previewed photo and its same-stage siblings from the LIVE tree,
  // so the lightbox reflects selection toggles and can navigate within the stage.
  // Siblings are the photos of the stage the opened photo belongs to (matched by
  // repairStageId), ordered by captureOrder — the same order shown in the grid.
  const lightboxCtx = useMemo(() => {
    if (!lightboxPhotoId || !tree) return null;
    for (const node of tree) {
      for (const stage of node.stages) {
        const match = stage.photos.find((p) => p.id === lightboxPhotoId);
        if (match) {
          const siblings = stage.photos
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

  // Navigate to the previous/next photo of the same stage (loops at the edges).
  const handleLightboxNav = (dir: -1 | 1) => {
    if (!lightboxCtx || lightboxCtx.siblings.length < 2) return;
    const n = lightboxCtx.siblings.length;
    const nextIdx = (lightboxCtx.index + dir + n) % n;
    setLightboxPhotoId(lightboxCtx.siblings[nextIdx]!.id);
  };

  // Generate a PDF report scoped to a SINGLE repair. The PDF service scopes by
  // repair_id (RepairReportData.defectId carries the repair_id), so we pass the
  // node's repairId — not the (now real) defect_id.
  const handleGenerateDefectPdf = async (repairId: string) => {
    if (!campaignId || !repairId) return;
    setDownloadingDefectId(repairId);
    try {
      // 1. Generar + descargar el PDF (el service ya NO persiste, solo devuelve
      //    el blob). Réplica exacta del patrón de inspección (ExportPanel).
      const { blob, filename } = await generateAndDownloadRepairReport({
        campaignId,
        defectId: repairId,
      });
      // 2. Apagar el spinner DE INMEDIATO tras generar+descargar (igual que
      //    inspección) — NO esperamos a la persistencia.
      setDownloadingDefectId(null);
      // 3. Optimista: mostrar el botón "Download report" ya.
      setRepairsWithReport((prev) => new Set(prev).add(repairId));
      // 4. Persistencia en IIFE background SIN await, anclada a ESTE componente
      //    montado (RepairWorkflow sigue montado mientras el usuario está en
      //    /repairs/:campaignId, así el upload+insert completan aunque tarden).
      (async () => {
        try {
          const storagePath = await persistRepairReport(blob, repairId, filename);
          if (!storagePath || storagePath.startsWith('pending/')) {
            // Si el upload falló, revertir el optimismo para no mostrar un botón
            // de descarga que no descargaría nada real.
            setRepairsWithReport((prev) => {
              const n = new Set(prev);
              n.delete(repairId);
              return n;
            });
          }
        } catch {
          /* silent */
        }
      })();
    } catch (err) {
      toast.error((err as Error)?.message || t('repair.pdfError'));
      setDownloadingDefectId(null);
    }
  };

  // Download a PREVIOUSLY generated report from storage, without regenerating.
  // Falls back to regenerating if the persisted file could not be resolved.
  const handleDownloadDefectPdf = async (repairId: string) => {
    if (!campaignId || !repairId) return;
    setDownloadingDefectId(repairId);
    try {
      const opened = await downloadPersistedRepairReport(repairId);
      if (opened) {
        setDownloadingDefectId(null);
        return;
      }
      // Fallback: no había archivo persistido → regenerar (mismo patrón que
      // handleGenerateDefectPdf: generar + descargar, spinner off, persistir en
      // IIFE background sin await).
      const { blob, filename } = await generateAndDownloadRepairReport({
        campaignId,
        defectId: repairId,
      });
      setDownloadingDefectId(null);
      setRepairsWithReport((prev) => new Set(prev).add(repairId));
      (async () => {
        try {
          const storagePath = await persistRepairReport(blob, repairId, filename);
          if (!storagePath || storagePath.startsWith('pending/')) {
            setRepairsWithReport((prev) => {
              const n = new Set(prev);
              n.delete(repairId);
              return n;
            });
          }
        } catch {
          /* silent */
        }
      })();
    } catch (err) {
      toast.error((err as Error)?.message || t('repair.pdfError'));
      setDownloadingDefectId(null);
    }
  };

  // Permanently delete a defect from the campaign (whole work_order chain).
  const handleDeleteDefect = (node: RepairDefectNode) => {
    if (isClient) return;
    if (!window.confirm(t('repair.deleteDefectConfirm'))) return;
    deleteDefect.mutate(
      {
        workOrderId: node.workOrderId,
        repairId: node.repairId,
        defectId: node.defect.id,
      },
      {
        onSuccess: () => toast.success(t('repair.deleteDefectSuccess')),
        onError: (err) =>
          toast.error((err as Error)?.message || t('repair.deleteDefectError')),
      },
    );
  };

  // Reopen a FINISHED defect (repair.status 'completed' → 'in_progress'). As a
  // consequence the service resumes the campaign if it was repair_done. Returns
  // a promise so the button can show a spinner while saving.
  const handleReopenDefect = (repairId: string) =>
    new Promise<void>((resolve, reject) => {
      reopenDefect.mutate(repairId, {
        onSuccess: () => {
          toast.success(t('repair.reopenDefectSuccess'));
          resolve();
        },
        onError: (err) => {
          toast.error((err as Error)?.message || t('repair.reopenDefectError'));
          reject(err);
        },
      });
    });

  // Persist the three editable defect fields (type, defect_number,
  // defect_identifier) with a DIRECT update — the manual number is NOT
  // recomputed. Returns a promise so the card can await + exit edit mode.
  const handleSaveDefectFields = (
    defectId: string,
    fields: { type: string; defectNumber: string; defectIdentifier: string },
  ) =>
    new Promise<void>((resolve, reject) => {
      updateDefectFields.mutate(
        {
          defectId,
          type: fields.type,
          defectNumber: fields.defectNumber.trim() || null,
          defectIdentifier: fields.defectIdentifier.trim() || null,
        },
        {
          onSuccess: () => {
            toast.success(t('repair.editSuccess'));
            resolve();
          },
          onError: (err) => {
            toast.error((err as Error)?.message || t('repair.editError'));
            reject(err);
          },
        },
      );
    });

  // Persist ONLY the defect's severity (= the "Start category") with a DIRECT
  // update on the `defect` table, without touching the other defect fields
  // (type/number/identifier). Severity belongs to the DEFECT, not the repair
  // row, so this goes through updateDefectFields (NOT onSaveProgress).
  const handleSaveDefectSeverity = (defectId: string, severity: number | null) =>
    new Promise<void>((resolve, reject) => {
      updateDefectFields.mutate(
        { defectId, severity },
        {
          onSuccess: () => {
            toast.success(t('repair.editSuccess'));
            resolve();
          },
          onError: (err) => {
            toast.error((err as Error)?.message || t('repair.editError'));
            reject(err);
          },
        },
      );
    });

  // Persist a single repair progress field (start/final category, assigned
  // technician, or progress %) with a DIRECT update on the repair row. Fired
  // immediately on change (combobox) or on blur/debounce (progress %).
  const handleSaveProgress = (
    repairId: string,
    fields: {
      startCategory?: number | null;
      finalCategory?: number | null;
      assignedTechnicianId?: string | null;
      progressPercent?: number | null;
    },
  ) =>
    new Promise<void>((resolve, reject) => {
      updateRepairProgress.mutate(
        { repairId, ...fields },
        {
          onSuccess: () => {
            toast.success(t('repair.editSuccess'));
            resolve();
          },
          onError: (err) => {
            toast.error((err as Error)?.message || t('repair.editError'));
            reject(err);
          },
        },
      );
    });

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
        </div>
      </div>

      <p style={hint}>{t('repair.workflowHint')}</p>

      {treeLoading ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('general.loading')}</p>
      ) : !tree || tree.length === 0 ? (
        <p style={{ color: C.muted, padding: 24 }}>{t('repair.noDefects')}</p>
      ) : (
        <div style={defectsWrap}>
          {groupDefectsByBlade(tree).map((group) => (
            <BladeGroupSection
              key={group.position}
              group={group}
              locale={locale}
              t={t}
              readOnly={isClient}
              pendingPhotoIds={pendingPhotoIds}
              onSelect={handleSelect}
              onMovePhoto={isClient ? undefined : handleMovePhoto}
              onUploadPhoto={isClient ? undefined : handleUploadPhotos}
              onPreview={handlePreview}
              onGenerateReport={handleGenerateDefectPdf}
              onDownloadReport={handleDownloadDefectPdf}
              repairsWithReport={repairsWithReport}
              onDelete={isClient ? undefined : handleDeleteDefect}
              onReopenDefect={isClient ? undefined : handleReopenDefect}
              downloadingDefectId={downloadingDefectId}
              onSaveDefectFields={isClient ? undefined : handleSaveDefectFields}
              onSaveDefectSeverity={isClient ? undefined : handleSaveDefectSeverity}
              typeOptions={typeOptions}
              technicians={technicians}
              onSaveProgress={isClient ? undefined : handleSaveProgress}
            />
          ))}
        </div>
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
                background: lightbox.repairSelected ? C.brand : 'rgba(255,255,255,0.15)',
                cursor: pendingPhotoIds.has(lightbox.id) ? 'progress' : 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(lightbox, !lightbox.repairSelected);
              }}
              aria-label={t('repair.selectedForReport')}
              aria-pressed={lightbox.repairSelected}
              title={t('repair.selectedForReport')}
            >
              <Star
                size={20}
                color="#fff"
                fill={lightbox.repairSelected ? '#fff' : 'none'}
              />
            </button>
          )}
          <button style={lightboxClose} onClick={() => setLightboxPhotoId(null)} aria-label={t('general.close')}>
            <X size={22} />
          </button>

          {/* Navigation arrows — only within the same stage, ≥2 photos */}
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

// ─── Blade group (collapsible) ─────────────────────────────────────────────────

interface BladeGroupSectionProps {
  group: BladeGroup;
  locale: 'es' | 'en';
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: RepairPhoto, selected: boolean) => void;
  /** Move a photo to another stage of the same defect (undefined = read-only client). */
  onMovePhoto?: (photo: RepairPhoto, targetStageId: string, targetStageCode: string) => void;
  /** Upload image files into a specific stage (undefined = read-only client). */
  onUploadPhoto?: (
    files: File[],
    target: { repairId: string; repairStageId: string; stageCode: string },
  ) => Promise<void>;
  onPreview: (photo: RepairPhoto) => void;
  onGenerateReport: (repairId: string) => void;
  onDownloadReport: (repairId: string) => void;
  repairsWithReport: Set<string>;
  onDelete?: (node: RepairDefectNode) => void;
  /** Reopen a finished defect (undefined = read-only client). */
  onReopenDefect?: (repairId: string) => Promise<void>;
  downloadingDefectId: string | null;
  /** Persist the three editable defect fields (undefined = read-only client). */
  onSaveDefectFields?: (
    defectId: string,
    fields: { type: string; defectNumber: string; defectIdentifier: string },
  ) => Promise<void>;
  /** Persist ONLY the defect's severity = "Start category" (undefined = read-only client). */
  onSaveDefectSeverity?: (defectId: string, severity: number | null) => Promise<void>;
  /** Full list of annotation type names offered by the inline type <select>. */
  typeOptions: string[];
  /** Technicians (role='technician') for the "Técnico a cargo" combobox. */
  technicians: Technician[];
  /** Persist a repair progress field (undefined = read-only client). */
  onSaveProgress?: (
    repairId: string,
    fields: {
      startCategory?: number | null;
      finalCategory?: number | null;
      assignedTechnicianId?: string | null;
      progressPercent?: number | null;
    },
  ) => Promise<void>;
}

/**
 * A collapsible group of defects for a single blade. Blades start COLLAPSED on
 * page load (only the blade header is visible); selecting a blade header expands
 * it and reveals its defects, each with its full composed identifier.
 */
function BladeGroupSection({
  group,
  locale,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onMovePhoto,
  onUploadPhoto,
  onPreview,
  onGenerateReport,
  onDownloadReport,
  repairsWithReport,
  onDelete,
  onReopenDefect,
  downloadingDefectId,
  onSaveDefectFields,
  onSaveDefectSeverity,
  typeOptions,
  technicians,
  onSaveProgress,
}: BladeGroupSectionProps) {
  const [open, setOpen] = useState(false);
  const bladeLabel = group.serial
    ? `${t('repair.bladeNo')} ${group.serial}`
    : `${t('repair.blade')} ${group.label}`;

  return (
    <div style={bladeGroup}>
      <button style={bladeGroupHeader} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <span style={bladeGroupTitle}>{bladeLabel}</span>
        <span style={bladeGroupCount}>
          {group.nodes.length} {t('repair.defects')}
        </span>
      </button>

      {open && (
        <div style={bladeGroupBody}>
          {group.nodes.map((node) => (
            <DefectSection
              key={node.defect.id}
              node={node}
              locale={locale}
              t={t}
              readOnly={readOnly}
              pendingPhotoIds={pendingPhotoIds}
              onSelect={onSelect}
              onMovePhoto={onMovePhoto}
              onUploadPhoto={onUploadPhoto}
              onPreview={onPreview}
              onGenerateReport={onGenerateReport}
              onDownloadReport={onDownloadReport}
              hasReport={node.repairId != null && repairsWithReport.has(node.repairId)}
              onDelete={onDelete}
              onReopenDefect={onReopenDefect}
              downloading={node.repairId != null && downloadingDefectId === node.repairId}
              onSaveDefectFields={onSaveDefectFields}
              onSaveDefectSeverity={onSaveDefectSeverity}
              typeOptions={typeOptions}
              technicians={technicians}
              onSaveProgress={onSaveProgress}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Defect section (level 1) ──────────────────────────────────────────────────

interface DefectSectionProps {
  node: RepairDefectNode;
  locale: 'es' | 'en';
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: RepairPhoto, selected: boolean) => void;
  /** Move a photo to another stage of the same defect (undefined = read-only client). */
  onMovePhoto?: (photo: RepairPhoto, targetStageId: string, targetStageCode: string) => void;
  /** Upload image files into a specific stage (undefined = read-only client). */
  onUploadPhoto?: (
    files: File[],
    target: { repairId: string; repairStageId: string; stageCode: string },
  ) => Promise<void>;
  onPreview: (photo: RepairPhoto) => void;
  onGenerateReport: (repairId: string) => void;
  onDownloadReport: (repairId: string) => void;
  /** True when this repair already has a persisted report → show "Download". */
  hasReport: boolean;
  onDelete?: (node: RepairDefectNode) => void;
  /** Reopen a finished defect (undefined = read-only client). */
  onReopenDefect?: (repairId: string) => Promise<void>;
  downloading: boolean;
  /** Persist the three editable defect fields (undefined = read-only client). */
  onSaveDefectFields?: (
    defectId: string,
    fields: { type: string; defectNumber: string; defectIdentifier: string },
  ) => Promise<void>;
  /** Persist ONLY the defect's severity = "Start category" (undefined = read-only client). */
  onSaveDefectSeverity?: (defectId: string, severity: number | null) => Promise<void>;
  /** Full list of annotation type names offered by the inline type <select>. */
  typeOptions: string[];
  /** Technicians (role='technician') for the "Técnico a cargo" combobox. */
  technicians: Technician[];
  /** Persist a repair progress field (undefined = read-only client). */
  onSaveProgress?: (
    repairId: string,
    fields: {
      startCategory?: number | null;
      finalCategory?: number | null;
      assignedTechnicianId?: string | null;
      progressPercent?: number | null;
    },
  ) => Promise<void>;
}

function DefectSection({
  node,
  locale,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onMovePhoto,
  onUploadPhoto,
  onPreview,
  onGenerateReport,
  onDownloadReport,
  hasReport,
  onDelete,
  onReopenDefect,
  downloading,
  onSaveDefectFields,
  onSaveDefectSeverity,
  typeOptions,
  technicians,
  onSaveProgress,
}: DefectSectionProps) {
  // Defects start COLLAPSED on page load; the user expands the ones they want.
  const [open, setOpen] = useState(false);
  const { defect } = node;

  // ── Per-defect repair progress state (start/final category, technician, %) ─
  // Always-visible controls (not gated by the pencil edit mode). Each combobox
  // persists immediately on change; the % input persists on blur to avoid a
  // write per keystroke. Seeded from the node's saved values.
  const canEditProgress = Boolean(onSaveProgress) && node.repairId != null;
  // "Categoría de inicio" is bound to the DEFECT's severity (not the repair
  // row). 0/falsy severity is treated as "no value" (empty option), matching
  // how severity is mapped (severity: Number(...) || 0).
  const canEditSeverity = Boolean(onSaveDefectSeverity);
  const [startCat, setStartCat] = useState<string>(
    node.defect.severity ? String(node.defect.severity) : '',
  );
  const [finalCat, setFinalCat] = useState<string>(
    node.finalCategory != null ? String(node.finalCategory) : '',
  );
  const [assignedTech, setAssignedTech] = useState<string>(node.assignedTechnicianId ?? '');
  const [progress, setProgress] = useState<string>(
    node.progressPercent != null ? String(node.progressPercent) : '',
  );

  // Re-seed when the node's saved values change (e.g. after a tree refetch).
  useEffect(() => {
    setStartCat(node.defect.severity ? String(node.defect.severity) : '');
    setFinalCat(node.finalCategory != null ? String(node.finalCategory) : '');
    setAssignedTech(node.assignedTechnicianId ?? '');
    setProgress(node.progressPercent != null ? String(node.progressPercent) : '');
  }, [node.defect.severity, node.finalCategory, node.assignedTechnicianId, node.progressPercent]);

  const commitProgressField = (fields: {
    startCategory?: number | null;
    finalCategory?: number | null;
    assignedTechnicianId?: string | null;
    progressPercent?: number | null;
  }) => {
    if (!onSaveProgress || node.repairId == null) return;
    void onSaveProgress(node.repairId, fields).catch(() => {
      /* toast handled upstream */
    });
  };

  // "Categoría de inicio" writes the DEFECT's severity (NOT the repair row),
  // so it goes through onSaveDefectSeverity (updateDefectFields), not onSaveProgress.
  const handleStartCatChange = (value: string) => {
    setStartCat(value);
    if (!onSaveDefectSeverity) return;
    void onSaveDefectSeverity(node.defect.id, value === '' ? null : Number(value)).catch(() => {
      /* toast handled upstream */
    });
  };
  const handleFinalCatChange = (value: string) => {
    setFinalCat(value);
    commitProgressField({ finalCategory: value === '' ? null : Number(value) });
  };
  const handleAssignedTechChange = (value: string) => {
    setAssignedTech(value);
    commitProgressField({ assignedTechnicianId: value === '' ? null : value });
  };
  // Persist % on blur: clamp to 0-100, treat blank as null.
  const commitProgress = () => {
    const trimmed = progress.trim();
    if (trimmed === '') {
      if (node.progressPercent != null) commitProgressField({ progressPercent: null });
      return;
    }
    let n = Number(trimmed);
    if (isNaN(n)) return;
    n = Math.max(0, Math.min(100, Math.round(n)));
    if (String(n) !== String(node.progressPercent ?? '')) {
      setProgress(String(n));
      commitProgressField({ progressPercent: n });
    }
  };

  // ── Reopen-defect state (spinner while the status flips to in_progress) ───
  const [reopening, setReopening] = useState(false);
  // Only a FINISHED defect (repair.status 'completed') with a repair row can be
  // reopened; and never for the read-only client (onReopenDefect is undefined).
  const canReopenDefect =
    Boolean(onReopenDefect) && node.repairId != null && node.repairStatus === 'completed';
  const handleReopen = async () => {
    if (!onReopenDefect || node.repairId == null || reopening) return;
    setReopening(true);
    try {
      await onReopenDefect(node.repairId);
    } catch {
      /* toast handled upstream */
    } finally {
      setReopening(false);
    }
  };

  // ── Inline edit state for the three editable fields ──────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editType, setEditType] = useState(defect.type);
  const [editNumber, setEditNumber] = useState(defect.defectNumber ?? '');
  const [editIdentifier, setEditIdentifier] = useState(defect.defectIdentifier ?? '');
  const canEdit = Boolean(onSaveDefectFields);

  const startEdit = () => {
    // Seed inputs from the current defect values each time edit opens.
    setEditType(defect.type);
    setEditNumber(defect.defectNumber ?? '');
    setEditIdentifier(defect.defectIdentifier ?? '');
    setOpen(true);
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = async () => {
    if (!onSaveDefectFields || saving) return;
    setSaving(true);
    try {
      await onSaveDefectFields(defect.id, {
        type: editType,
        defectNumber: editNumber,
        defectIdentifier: editIdentifier,
      });
      setEditing(false);
    } catch {
      /* toast handled upstream; stay in edit mode so the user can retry */
    } finally {
      setSaving(false);
    }
  };

  // Type <select> options: the full list of annotation type names (coherent
  // with the Excel importer and the annotations). The defect_type_check
  // constraint now accepts all of them. Ensure the current type is always
  // present so the current value is never lost even if it's not in the list.
  const typeSelectOptions = typeOptions.includes(editType)
    ? typeOptions
    : [editType, ...typeOptions];

  const totalPhotos = node.stages.reduce((acc, s) => acc + s.photos.length, 0);
  const selectedPhotos = node.stages.reduce(
    (acc, s) => acc + s.photos.filter((p) => p.repairSelected).length,
    0,
  );
  // Correlative matching the Analyze step (e.g. "A1"); falls back to blade letter.
  const defectNumber =
    defect.defectNumber ?? (BLADE_LABELS[defect.bladePosition] || '—');
  const statusLabel =
    node.repairStatus === 'completed'
      ? t('repair.repairCompleted')
      : node.repairStatus === 'in_progress'
        ? t('repair.repairInProgress')
        : null;

  return (
    <div style={defectCard}>
      <button style={defectHeader} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <span style={defectIndex}>{defectNumber}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={defectTitle}>
            {/* Title = defect TYPE + " - " + defect_identifier (when present).
                The per-blade code (e.g. "A1") is NOT repeated here because it's
                already shown in the green badge on the left. The identifier
                (e.g. "Daño 1") comes from the spreadsheet and is appended after
                a dash when available. */}
            {defect.defectIdentifier?.trim()
              ? `${formatDefectType(defect.type, locale)} - ${defect.defectIdentifier.trim()}`
              : formatDefectType(defect.type, locale)}
          </div>
          <div style={defectMeta}>
            {t('repair.category')} {defect.severity || '—'}
            {node.technicianName ? ` · ${node.technicianName}` : ''}
            {statusLabel ? ` · ${statusLabel}` : ''}
          </div>
        </div>
        <span style={defectCount}>
          {totalPhotos} {t('repair.photos')} · {selectedPhotos} {t('repair.selected')}
        </span>
        {(() => {
          // A defect with no repair yet has no report → disable the PDF button.
          const hasRepair = node.repairId != null;
          const disabled = downloading || !hasRepair;
          // "Generate report" always keeps its own label/behavior (generate +
          // persist + download). When a report already exists, an ADDITIONAL
          // "Download report" button is shown alongside it (fetches the
          // persisted PDF without regenerating).
          const generateLabel = t('repair.generateReport');
          const downloadLabel = t('repair.downloadReport');
          const triggerGenerate = () => {
            if (disabled || !node.repairId) return;
            onGenerateReport(node.repairId);
          };
          const triggerDownload = () => {
            if (disabled || !node.repairId) return;
            onDownloadReport(node.repairId);
          };
          return (
            <>
              <span
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                style={{
                  ...defectPdfBtn,
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerGenerate();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    triggerGenerate();
                  }
                }}
                title={hasRepair ? generateLabel : t('repair.notStarted')}
              >
                {downloading && (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                )}
                {generateLabel}
              </span>
              {hasReport && (
                <span
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  style={{
                    ...defectPdfIconBtn,
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerDownload();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      triggerDownload();
                    }
                  }}
                  title={downloadLabel}
                  aria-label={downloadLabel}
                >
                  {downloading ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Download size={14} />
                  )}
                </span>
              )}
            </>
          );
        })()}
        {canEdit && !editing && (
          <span
            role="button"
            tabIndex={0}
            style={defectEditBtn}
            onClick={(e) => {
              e.stopPropagation();
              startEdit();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                startEdit();
              }
            }}
            title={t('repair.editDefect')}
          >
            <Pencil size={14} />
            {t('repair.editDefect')}
          </span>
        )}
        {!readOnly && onDelete && (
          <span
            role="button"
            tabIndex={0}
            style={defectDeleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onDelete(node);
              }
            }}
            title={t('repair.deleteDefect')}
          >
            <Trash2 size={14} />
            {t('repair.deleteDefect')}
          </span>
        )}
        {canReopenDefect && (
          <span
            role="button"
            tabIndex={0}
            style={{
              ...defectReopenBtn,
              opacity: reopening ? 0.5 : 1,
              cursor: reopening ? 'not-allowed' : 'pointer',
            }}
            aria-disabled={reopening}
            onClick={(e) => {
              e.stopPropagation();
              if (!reopening) void handleReopen();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                if (!reopening) void handleReopen();
              }
            }}
            title={t('repair.reopenDefect')}
          >
            {reopening ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <RotateCcw size={14} />
            )}
            {t('repair.reopenDefect')}
          </span>
        )}
      </button>

      {/* Always-visible per-defect repair progress controls (start/final
          category, assigned technician, progress %). Shown right below the
          defect header and BEFORE the stages. Read-only for the client. */}
      <div style={progressBlock}>
        <label style={editField}>
          <span style={editLabel}>{t('repair.startCategory')}</span>
          <select
            style={editSelect}
            value={startCat}
            onChange={(e) => handleStartCatChange(e.target.value)}
            disabled={!canEditSeverity}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Cat {n}
              </option>
            ))}
          </select>
        </label>
        <label style={editField}>
          <span style={editLabel}>{t('repair.finalCategory')}</span>
          <select
            style={editSelect}
            value={finalCat}
            onChange={(e) => handleFinalCatChange(e.target.value)}
            disabled={!canEditProgress}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Cat {n}
              </option>
            ))}
          </select>
        </label>
        <label style={editField}>
          <span style={editLabel}>{t('repair.assignedTechnician')}</span>
          <select
            style={editSelect}
            value={assignedTech}
            onChange={(e) => handleAssignedTechChange(e.target.value)}
            disabled={!canEditProgress}
          >
            <option value="">—</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
        </label>
        <label style={editField}>
          <span style={editLabel}>{t('repair.progressPercent')}</span>
          <input
            type="number"
            min={0}
            max={100}
            style={editInput}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            onBlur={commitProgress}
            disabled={!canEditProgress}
            placeholder="0-100"
          />
        </label>
      </div>

      {editing && (
        <div style={editForm}>
          <div style={editFieldsRow}>
            <label style={editField}>
              <span style={editLabel}>{t('repair.editType')}</span>
              <select
                style={editSelect}
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                disabled={saving}
              >
                {typeSelectOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatDefectType(opt, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label style={editField}>
              <span style={editLabel}>{t('repair.editDefectNumber')}</span>
              <input
                type="text"
                style={editInput}
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                disabled={saving}
                placeholder="C1"
              />
            </label>
            <label style={editField}>
              <span style={editLabel}>{t('repair.editDefectIdentifier')}</span>
              <input
                type="text"
                style={editInput}
                value={editIdentifier}
                onChange={(e) => setEditIdentifier(e.target.value)}
                disabled={saving}
                placeholder="Daño1 ..."
              />
            </label>
          </div>
          <div style={editActions}>
            <button type="button" style={editCancelBtn} onClick={cancelEdit} disabled={saving}>
              <X size={14} /> {t('repair.editCancel')}
            </button>
            <button type="button" style={editSaveBtn} onClick={saveEdit} disabled={saving}>
              {saving ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Check size={14} />
              )}
              {t('repair.editSave')}
            </button>
          </div>
        </div>
      )}

      {open && (
        <StagesList
          node={node}
          t={t}
          readOnly={readOnly}
          pendingPhotoIds={pendingPhotoIds}
          onSelect={onSelect}
          onMovePhoto={onMovePhoto}
          onUploadPhoto={onUploadPhoto}
          onPreview={onPreview}
        />
      )}
    </div>
  );
}

// ─── Stages list (owns the shared cross-stage move highlight) ───────────────────

interface StagesListProps {
  node: RepairDefectNode;
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: RepairPhoto, selected: boolean) => void;
  onMovePhoto?: (photo: RepairPhoto, targetStageId: string, targetStageCode: string) => void;
  onUploadPhoto?: (
    files: File[],
    target: { repairId: string; repairStageId: string; stageCode: string },
  ) => Promise<void>;
  onPreview: (photo: RepairPhoto) => void;
}

/**
 * Renders a defect's stages and owns the cross-stage move highlight as a SINGLE
 * shared state (`hoverTargetStageId`) instead of one `stageDropActive` boolean
 * per StageRow.
 *
 * Why this fixes the stuck green border on the DESTINATION stage: with per-row
 * local state, dropping on the target stage created a race — the last
 * `onDragOver` set that row's `stageDropActive=true`, then `onDrop` fired the
 * optimistic update that re-renders/remounts the target row's photos, and the
 * global `dragend` tried to set `false`. Because each row owned its own state
 * and the target re-rendered mid-flight, the `false` wasn't guaranteed to win,
 * so the border stuck. With ONE shared value, a single `setHoverTargetStageId(null)`
 * clears every stage at once — there are no competing per-row states left to
 * leave stale, so the whole class of bug is gone.
 *
 * Reset is unconditional on both the drop (inside each StageRow, after calling
 * onMovePhoto) and on a document-level `dragend` listener mounted ONCE here.
 */
function StagesList({
  node,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onMovePhoto,
  onUploadPhoto,
  onPreview,
}: StagesListProps) {
  // Which stage is currently hovered as the target of a cross-stage move
  // (null = none). Shared by every StageRow of this defect.
  const [hoverTargetStageId, setHoverTargetStageId] = useState<string | null>(null);

  // Single global drag-end safety net for the WHOLE defect: whenever any HTML5
  // drag finishes (drop OR cancel), clear the shared highlight. Mounted once —
  // not once per StageRow — so there's exactly one reset and no race between
  // multiple listeners/states. `drop` is covered too because some browsers skip
  // `dragend` on a source whose DOM node was removed by the optimistic re-render.
  useEffect(() => {
    const clear = () => setHoverTargetStageId(null);
    document.addEventListener('dragend', clear);
    document.addEventListener('drop', clear);
    return () => {
      document.removeEventListener('dragend', clear);
      document.removeEventListener('drop', clear);
    };
  }, []);

  return (
    <div style={stagesWrap}>
      {node.stages.map((stage) => (
        <StageRow
          key={stage.stageId ?? stage.stageCode}
          defectId={node.defect.id}
          repairId={node.repairId}
          stage={stage}
          defectStages={node.stages}
          t={t}
          readOnly={readOnly}
          pendingPhotoIds={pendingPhotoIds}
          onSelect={onSelect}
          onMovePhoto={onMovePhoto}
          onUploadPhoto={onUploadPhoto}
          onPreview={onPreview}
          hoverTargetStageId={hoverTargetStageId}
          setHoverTargetStageId={setHoverTargetStageId}
        />
      ))}
    </div>
  );
}

// ─── Stage row (level 2, with drag&drop) ────────────────────────────────────────

interface StageRowProps {
  defectId: string;
  /** The defect's repair_id (null when no repair row exists yet). Required to
      upload a photo; uploads are disabled when null. */
  repairId: string | null;
  stage: RepairStageNode;
  /** All stages of the defect — used to resolve a photo dragged in from
      another stage (it isn't in this stage's own photos list). */
  defectStages: RepairStageNode[];
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: RepairPhoto, selected: boolean) => void;
  /** Move a photo to another stage of the same defect (undefined = read-only client). */
  onMovePhoto?: (photo: RepairPhoto, targetStageId: string, targetStageCode: string) => void;
  /** Upload image files into THIS stage (undefined = read-only client). */
  onUploadPhoto?: (
    files: File[],
    target: { repairId: string; repairStageId: string; stageCode: string },
  ) => Promise<void>;
  onPreview: (photo: RepairPhoto) => void;
  /** Stage id currently hovered as a cross-stage move target (shared by all
      StageRows of the defect). This row is highlighted when it equals its own
      stageId. */
  hoverTargetStageId: string | null;
  /** Setter for the shared hover target. Called with this stage's id on
      foreign dragOver, and with null on drop/leave to clear the highlight. */
  setHoverTargetStageId: (id: string | null) => void;
}

// Custom dataTransfer MIME carrying the ORIGIN stage id of the dragged photo.
// Lets a drop target tell "move to another stage" (origin != this stage) apart
// from "select within the same stage" (origin == this stage). Catalog fallback
// stages have stageId null → serialized as an empty string.
const STAGE_MIME = 'application/x-stage-id';

// Origin stage id of the drag currently in flight. dataTransfer.getData() is
// NOT readable during `dragover` in most browsers (only on `drop`), so the
// drop zones can't use it to decide, mid-drag, whether to highlight. This
// module-level value is set on dragStart and read synchronously during
// dragover to distinguish a cross-stage move from a same-stage selection. It's
// safe as a singleton because only one HTML5 drag can be in flight at a time.
let activeDragOriginStageId: string | null = null;

// True when the drag in flight carries OS files (a file drag from the laptop),
// as opposed to an internal HTML5 photo-card drag (text/plain + STAGE_MIME).
// Used to tell "upload from disk" apart from "move/select a photo".
function isFileDrag(e: React.DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  // DataTransfer.types is a DOMStringList/array; 'Files' is present on OS drags.
  return Array.from(types).includes('Files');
}

function StageRow({
  defectId,
  repairId,
  stage,
  defectStages,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onMovePhoto,
  onUploadPhoto,
  onPreview,
  hoverTargetStageId,
  setHoverTargetStageId,
}: StageRowProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  // File-upload drop highlight (OS file drag over this stage) + in-flight state.
  const [fileDropActive, setFileDropActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // This stage's own id (empty string for catalog fallback stages with no id).
  const thisStageId = stage.stageId ?? '';
  // Cross-stage move highlight is derived from the SHARED hover target, not a
  // local boolean — so a single reset upstream clears every stage at once (see
  // StagesList). No per-row dragend listener is needed for the stage highlight.
  const stageDropActive = hoverTargetStageId != null && hoverTargetStageId === thisStageId;

  // Safety net for the same-stage selection-column highlight (`dropActive`).
  // Its drop/leave handlers normally clear it, but a cancelled drag may skip
  // the leave; a single dragend reset guarantees it never sticks. (The
  // cross-stage move highlight is handled upstream by StagesList's shared
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

  const photos = stage.photos;
  const available = photos.filter((p) => !p.repairSelected);
  const selected = photos.filter((p) => p.repairSelected);
  // Scope drop zone to this defect+stage to avoid cross-stage drops.
  const dropKey = `${defectId}::${stage.stageCode}`;

  // This stage can RECEIVE a moved photo only when writable and it's a real
  // stage (has a repair_stage_id — catalog fallback stages have stageId null).
  const canReceiveMove = !readOnly && !!onMovePhoto && stage.stageId != null;

  // This stage can RECEIVE an UPLOAD (drop files from disk / "+" button) only
  // when writable, it's a real stage (has a repair_stage_id), and the defect
  // has a repair row (repairId) to attach the photo to. Catalog fallback stages
  // (no repair_stage_id) can't be uploaded to.
  const canUpload =
    !readOnly && !!onUploadPhoto && stage.stageId != null && repairId != null;

  // Run the upload for a batch of files, scoping the spinner to THIS stage.
  const runUpload = async (files: File[]) => {
    if (!canUpload || !onUploadPhoto || !repairId || !stage.stageId || files.length === 0) return;
    // Only keep image files; the service also re-validates each one.
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setUploading(true);
    try {
      await onUploadPhoto(images, {
        repairId,
        repairStageId: stage.stageId,
        stageCode: stage.stageCode,
      });
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

  // True when the in-flight drag started in a DIFFERENT stage than this one.
  // Reads the module-level origin tracker (dataTransfer.getData is unreadable
  // during dragover). On a real `drop` the dataTransfer value is authoritative
  // and used as a fallback when the tracker was already cleared.
  const isForeignDrag = (e: React.DragEvent) => {
    const origin = activeDragOriginStageId ?? e.dataTransfer.getData(STAGE_MIME);
    return origin !== (stage.stageId ?? '');
  };

  // Combined dragOver for the stage card: OS file drags (upload) take priority
  // and are kept separate from internal cross-stage photo moves.
  const handleStageDragOver = (e: React.DragEvent) => {
    if (canUpload && isFileDrag(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setFileDropActive(true);
      return;
    }
    if (!canReceiveMove) return;
    // Only react to cross-stage moves here; same-stage selection is handled by
    // the "selected" column drop zone below.
    if (!isForeignDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Point the SHARED hover target at this stage. Setting the same value
    // repeatedly (dragOver fires continuously) is a no-op for React, and
    // switching stages reassigns it so only one stage is ever highlighted.
    setHoverTargetStageId(thisStageId);
  };

  const handleStageDrop = (e: React.DragEvent) => {
    // OS file drop → upload into this stage.
    if (canUpload && isFileDrag(e)) {
      e.preventDefault();
      setFileDropActive(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) void runUpload(Array.from(files));
      return;
    }
    if (!canReceiveMove) return;
    const origin = e.dataTransfer.getData(STAGE_MIME) || (activeDragOriginStageId ?? '');
    // Same-stage drop → let the inner "selected" column handle it.
    if (origin === thisStageId) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const photo = photos.find((p) => p.id === id);
    // The dragged photo belongs to another stage, so it won't be in this
    // stage's photos; find it from the full defect tree instead.
    const moved = photo ?? defectStages.flatMap((s) => s.photos).find((p) => p.id === id);
    if (moved && onMovePhoto) {
      onMovePhoto(moved, stage.stageId!, stage.stageCode);
    }
    // Reset the shared highlight LAST and unconditionally (single shared value,
    // see StagesList). The global dragend in StagesList is the backstop.
    setHoverTargetStageId(null);
  };

  // Enable the drag handlers when EITHER move or upload is possible.
  const dragEnabled = canReceiveMove || canUpload;

  return (
    <div
      style={{
        ...stageCard,
        ...(stageDropActive ? stageDropActiveStyle : {}),
        ...(fileDropActive ? stageDropActiveStyle : {}),
      }}
      onDragOver={dragEnabled ? handleStageDragOver : undefined}
      // onDragLeave only clears the FILE-upload highlight (the move highlight is
      // managed by StagesList's shared state + global dragend). Guard against the
      // dragleave that fires when crossing into a child element by checking the
      // pointer actually left the card bounds.
      onDragLeave={
        canUpload
          ? (e) => {
              const related = e.relatedTarget as Node | null;
              if (!related || !e.currentTarget.contains(related)) setFileDropActive(false);
            }
          : undefined
      }
      onDrop={dragEnabled ? handleStageDrop : undefined}
    >
      <div style={stageHeader}>
        <span style={stageOrder}>{stage.sortOrder}</span>
        <h3 style={stageTitle}>{stage.stageLabel}</h3>
        <span style={stageCount}>
          {photos.length} {t('repair.photos')} · {selected.length} {t('repair.selected')}
        </span>
        {/* "Add photo" button + hidden input — alternative to drag&drop. Only
            when this stage can receive uploads (writable, real stage, repair
            exists). Shows a spinner while an upload is in flight. */}
        {canUpload && (
          <>
            <button
              type="button"
              style={stageAddBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={t('repair.addPhoto')}
            >
              {uploading ? (
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Plus size={13} />
              )}
              {t('repair.addPhoto')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={handleFileInput}
              style={{ display: 'none' }}
              aria-label={t('repair.addPhoto')}
            />
          </>
        )}
      </div>

      {/* File-drop hint: visible while an OS file drag hovers this stage, or a
          subtle persistent dropzone affordance when the stage is empty. */}
      {canUpload && (fileDropActive || photos.length === 0) && (
        <div style={{ ...stageDropHint, ...(fileDropActive ? stageDropHintActive : {}) }}>
          <Upload size={15} />
          <span>{uploading ? t('repair.uploading') : t('repair.dropToUpload')}</span>
        </div>
      )}

      {stage.note ? (
        <p style={stageNote}>
          <span style={stageNoteLabel}>{t('repair.stageNote')}:</span> {stage.note}
        </p>
      ) : null}

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
                    originStageId={stage.stageId}
                    dimmed={dragId === photo.id}
                    pending={pendingPhotoIds.has(photo.id)}
                    readOnly={readOnly}
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

          {/* Right: selected photos (drop zone). Handles ONLY same-stage
              selection (toggle selected_for_report). A photo dragged from
              ANOTHER stage is ignored here and handled by the stage-level drop
              zone (move to stage); its onDragOver/onDrop don't preventDefault
              so the event bubbles up to the stage card. */}
          <div
            style={{ ...col, ...(dropActive ? colDropActive : {}) }}
            data-drop={dropKey}
            onDragOver={
              readOnly
                ? undefined
                : (e) => {
                    // Foreign drag → let it bubble to the stage-level move zone.
                    if (isForeignDrag(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    setDropActive(true);
                    // A same-stage selection drag is NOT a cross-stage move, so
                    // make sure this stage isn't also highlighted as a move
                    // target (clears the shared hover if it points here).
                    if (hoverTargetStageId === thisStageId) setHoverTargetStageId(null);
                  }
            }
            onDragLeave={readOnly ? undefined : () => setDropActive(false)}
            onDrop={
              readOnly
                ? undefined
                : (e) => {
                    if (isForeignDrag(e)) return; // handled by stage-level drop
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
                    originStageId={stage.stageId}
                    dimmed={dragId === photo.id}
                    pending={pendingPhotoIds.has(photo.id)}
                    readOnly={readOnly}
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
  /** Origin stage id of this photo (null for catalog fallback stages). Written
      to the drag payload so a drop target can tell move-across-stage apart from
      select-within-stage. */
  originStageId: string | null;
  dimmed: boolean;
  /** True while this photo's selection mutation is in flight → shows a spinner. */
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
  originStageId,
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
  const { t } = useLanguage();
  // While pending, block drag + action to avoid a double-fire on the same photo.
  const interactive = !readOnly && !pending;
  const uploaderName = photo.uploadedBy ?? '—';
  // Short prefix (CP/CB) so the label fits under the thumbnail without truncating.
  const uploaderLabel = `${t('repair.uploadedByShort')}: ${uploaderName}`;
  return (
    <div style={photoCardWrap}>
    <div
      draggable={interactive}
      onDragStart={
        interactive
          ? (e) => {
              e.dataTransfer.setData('text/plain', photo.id);
              // Origin stage id → lets drop targets distinguish a cross-stage
              // move from a same-stage selection. Mirrored into the module-level
              // tracker because getData() is unreadable during dragover.
              e.dataTransfer.setData(STAGE_MIME, originStageId ?? '');
              activeDragOriginStageId = originStageId ?? '';
              e.dataTransfer.effectAllowed = 'move';
              onDragStart();
            }
          : undefined
      }
      onDragEnd={
        interactive
          ? () => {
              activeDragOriginStageId = null;
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
      {/* Selection control (star/remove) is hidden for read-only (client). */}
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
      {/* Processing overlay: shown while the photo's selection is being saved. */}
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
const hint: React.CSSProperties = { fontSize: 13, color: C.muted, marginBottom: 20 };
const defectsWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24 };
const bladeGroup: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', overflow: 'hidden',
};
const bladeGroupHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px',
  background: '#EFF5EF', border: 'none', borderLeft: '4px solid #5A8F5A', cursor: 'pointer',
  color: '#111827',
};
const bladeGroupTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: '#111827', flex: 1, textAlign: 'left',
};
const bladeGroupCount: React.CSSProperties = { fontSize: 12, color: C.muted, flexShrink: 0 };
const bladeGroupBody: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
};
const defectCard: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 12, background: '#fff', overflow: 'hidden',
};
const defectHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px',
  background: '#F7FAF7', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer',
  color: C.text,
};
const defectIndex: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 26,
  padding: '0 8px', borderRadius: 13, background: C.brand, color: '#fff', fontSize: 13, fontWeight: 700,
  flexShrink: 0,
};
const defectTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1a1a1a' };
const defectMeta: React.CSSProperties = { fontSize: 12, color: C.muted, marginTop: 2 };
const defectCount: React.CSSProperties = { fontSize: 12, color: C.muted, flexShrink: 0 };
const defectPdfBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: C.brand, color: '#fff',
  borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  flexShrink: 0, userSelect: 'none',
};
// Compact icon-only variant of defectPdfBtn: square, no text, brand green (#5A8F5A).
const defectPdfIconBtn: React.CSSProperties = {
  ...defectPdfBtn, gap: 0, padding: 7, width: 32, height: 32, justifyContent: 'center',
  background: '#5A8F5A',
};
const defectDeleteBtn: React.CSSProperties = {
  ...defectPdfBtn, background: '#EF4444',
};
const defectEditBtn: React.CSSProperties = {
  ...defectPdfBtn, background: '#6B7280',
};
const defectReopenBtn: React.CSSProperties = {
  ...defectPdfBtn, background: '#2563EB',
};
const editForm: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
  background: '#F7FAF7', borderBottom: `1px solid ${C.border}`,
};
const editFieldsRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
};
const editField: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const editLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.text };
const editInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 13, color: '#1a1a1a', background: '#fff', boxSizing: 'border-box',
};
const editSelect: React.CSSProperties = { ...editInput };
const editActions: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};
// Always-visible per-defect progress controls (start/final category, assigned
// technician, progress %), shown just below the defect header and before the
// stages. Mirrors the edit form look but is NOT gated by the pencil edit mode.
const progressBlock: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12,
  padding: 16, background: '#F7FAF7', borderBottom: `1px solid ${C.border}`,
};
const editSaveBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: C.brand, color: '#fff',
  border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer',
};
const editCancelBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 12,
  fontWeight: 600, cursor: 'pointer',
};
const stagesWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 };
const stageCard: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, background: '#fff',
  transition: 'border-color 0.15s, background 0.15s',
};
// Stage-level drop highlight when a photo from ANOTHER stage is dragged over
// this stage card (mirrors colDropActive used by the intra-stage selection).
const stageDropActiveStyle: React.CSSProperties = {
  borderColor: C.brand, background: 'rgba(90,143,90,0.06)', boxShadow: `0 0 0 2px ${C.brand} inset`,
};
const stageHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };
// "Add photo" button in the stage header (upload alternative to drag&drop).
const stageAddBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: C.brand, color: '#fff',
  border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', flexShrink: 0,
};
// Dashed hint shown when a file drag hovers the stage or the stage is empty.
const stageDropHint: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  border: `2px dashed ${C.border}`, borderRadius: 10, padding: '14px 10px',
  color: C.muted, fontSize: 12, fontWeight: 600, marginBottom: 10,
  transition: 'border-color 0.15s, background 0.15s, color 0.15s',
};
const stageDropHintActive: React.CSSProperties = {
  borderColor: C.brand, background: 'rgba(90,143,90,0.08)', color: C.brand,
};
const stageOrder: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
  borderRadius: '50%', background: 'rgba(90,143,90,0.15)', color: C.brand, fontSize: 11, fontWeight: 700, flexShrink: 0,
};
const stageTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0, flex: 1 };
const stageCount: React.CSSProperties = { fontSize: 12, color: C.muted };
const emptyStage: React.CSSProperties = { fontSize: 13, color: C.muted, padding: '4px 0' };
const stageNote: React.CSSProperties = {
  fontSize: 12, color: C.text, background: '#F7FAF7', border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '6px 10px', margin: '0 0 10px', lineHeight: 1.4,
};
const stageNoteLabel: React.CSSProperties = { fontWeight: 600, color: C.brand };
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
