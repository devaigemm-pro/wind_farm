import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Download, Loader2, Pencil, Star, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/components/design-system';
import { useToast } from '@/store/toastStore';
import { useAuth } from '@/hooks/useAuth';
import { useAnnotationTypes } from '@/hooks/useAnnotationTypes';
import {
  useRepairCampaignDetail,
  useRepairTree,
  useSetPhotoSelected,
  useDeleteRepairDefect,
  useUpdateDefectFields,
} from '@/hooks/useRepair';
import {
  generateAndDownloadRepairReport,
  getRepairsWithReport,
  downloadPersistedRepairReport,
  persistRepairReport,
} from '@/services/repairReportPdf.service';
import type { RepairDefectNode, RepairPhoto, RepairStageNode } from '@/services/repair.service';

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
  const deleteDefect = useDeleteRepairDefect(campaignId);
  const updateDefectFields = useUpdateDefectFields(campaignId);

  // defectId currently being generated (null = none). Scopes the spinner to
  // the specific defect card whose report is being generated.
  const [downloadingDefectId, setDownloadingDefectId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<RepairPhoto | null>(null);
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

  const handlePreview = (photo: RepairPhoto) => {
    if (photo.url) setLightbox(photo);
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
              onPreview={handlePreview}
              onGenerateReport={handleGenerateDefectPdf}
              onDownloadReport={handleDownloadDefectPdf}
              repairsWithReport={repairsWithReport}
              onDelete={isClient ? undefined : handleDeleteDefect}
              downloadingDefectId={downloadingDefectId}
              onSaveDefectFields={isClient ? undefined : handleSaveDefectFields}
              typeOptions={typeOptions}
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

// ─── Blade group (collapsible) ─────────────────────────────────────────────────

interface BladeGroupSectionProps {
  group: BladeGroup;
  locale: 'es' | 'en';
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: RepairPhoto, selected: boolean) => void;
  onPreview: (photo: RepairPhoto) => void;
  onGenerateReport: (repairId: string) => void;
  onDownloadReport: (repairId: string) => void;
  repairsWithReport: Set<string>;
  onDelete?: (node: RepairDefectNode) => void;
  downloadingDefectId: string | null;
  /** Persist the three editable defect fields (undefined = read-only client). */
  onSaveDefectFields?: (
    defectId: string,
    fields: { type: string; defectNumber: string; defectIdentifier: string },
  ) => Promise<void>;
  /** Full list of annotation type names offered by the inline type <select>. */
  typeOptions: string[];
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
  onPreview,
  onGenerateReport,
  onDownloadReport,
  repairsWithReport,
  onDelete,
  downloadingDefectId,
  onSaveDefectFields,
  typeOptions,
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
              onPreview={onPreview}
              onGenerateReport={onGenerateReport}
              onDownloadReport={onDownloadReport}
              hasReport={node.repairId != null && repairsWithReport.has(node.repairId)}
              onDelete={onDelete}
              downloading={node.repairId != null && downloadingDefectId === node.repairId}
              onSaveDefectFields={onSaveDefectFields}
              typeOptions={typeOptions}
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
  onPreview: (photo: RepairPhoto) => void;
  onGenerateReport: (repairId: string) => void;
  onDownloadReport: (repairId: string) => void;
  /** True when this repair already has a persisted report → show "Download". */
  hasReport: boolean;
  onDelete?: (node: RepairDefectNode) => void;
  downloading: boolean;
  /** Persist the three editable defect fields (undefined = read-only client). */
  onSaveDefectFields?: (
    defectId: string,
    fields: { type: string; defectNumber: string; defectIdentifier: string },
  ) => Promise<void>;
  /** Full list of annotation type names offered by the inline type <select>. */
  typeOptions: string[];
}

function DefectSection({
  node,
  locale,
  t,
  readOnly,
  pendingPhotoIds,
  onSelect,
  onPreview,
  onGenerateReport,
  onDownloadReport,
  hasReport,
  onDelete,
  downloading,
  onSaveDefectFields,
  typeOptions,
}: DefectSectionProps) {
  // Defects start COLLAPSED on page load; the user expands the ones they want.
  const [open, setOpen] = useState(false);
  const { defect } = node;

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
      </button>

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
        <div style={stagesWrap}>
          {node.stages.map((stage) => (
            <StageRow
              key={stage.stageId ?? stage.stageCode}
              defectId={defect.id}
              stage={stage}
              t={t}
              readOnly={readOnly}
              pendingPhotoIds={pendingPhotoIds}
              onSelect={onSelect}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stage row (level 2, with drag&drop) ────────────────────────────────────────

interface StageRowProps {
  defectId: string;
  stage: RepairStageNode;
  t: (key: string) => string;
  readOnly: boolean;
  pendingPhotoIds: Set<string>;
  onSelect: (photo: RepairPhoto, selected: boolean) => void;
  onPreview: (photo: RepairPhoto) => void;
}

function StageRow({ defectId, stage, t, readOnly, pendingPhotoIds, onSelect, onPreview }: StageRowProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const photos = stage.photos;
  const available = photos.filter((p) => !p.repairSelected);
  const selected = photos.filter((p) => p.repairSelected);
  // Scope drop zone to this defect+stage to avoid cross-stage drops.
  const dropKey = `${defectId}::${stage.stageCode}`;

  return (
    <div style={stageCard}>
      <div style={stageHeader}>
        <span style={stageOrder}>{stage.sortOrder}</span>
        <h3 style={stageTitle}>{stage.stageLabel}</h3>
        <span style={stageCount}>
          {photos.length} {t('repair.photos')} · {selected.length} {t('repair.selected')}
        </span>
      </div>

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

          {/* Right: selected photos (drop zone) */}
          <div
            style={{ ...col, ...(dropActive ? colDropActive : {}) }}
            data-drop={dropKey}
            onDragOver={
              readOnly
                ? undefined
                : (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDropActive(true);
                  }
            }
            onDragLeave={readOnly ? undefined : () => setDropActive(false)}
            onDrop={
              readOnly
                ? undefined
                : (e) => {
                    e.preventDefault();
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
              e.dataTransfer.effectAllowed = 'move';
              onDragStart();
            }
          : undefined
      }
      onDragEnd={interactive ? onDragEnd : undefined}
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
};
const stageHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };
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
