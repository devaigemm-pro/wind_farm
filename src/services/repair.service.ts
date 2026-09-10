import { supabase } from '@/lib/supabase';
import { REPAIR_STAGE_CATALOG } from '@/constants/repair-stages';
import type { RepairCampaignStatus } from '@/types';
import { buildCampaignAnnotationCodeMap, isUuid, BLADE_LETTERS as ANNOTATION_BLADE_LETTERS } from './defectNumbering';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Repair photos live in the repair_photo table ONLY (never inspection_photo).
// The technician app writes them under the PUBLIC 'inspection-photos' bucket at
// repairs/{repair_id}/{stage_code}/{filename}. repair_photo.storage_path already
// holds the full path relative to the bucket, so we resolve public URLs.
//
// This service reads repair data EXCLUSIVELY through the official RPCs provided
// by the mobile app team:
//   - get_repairs_for_quote(quote_id_param)   → one row per repair/defect
//   - get_repair_photos_by_stage(repair_id_param) → the 11 stages + photos[]
// It never touches inspection_photo for repair photos.
const PHOTO_BUCKET = 'inspection-photos';

export class RepairServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'RepairServiceError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Aggregated repair campaign header data (campaign + turbine + wind farm). */
export interface RepairCampaignDetail {
  id: string;
  name: string;
  status: RepairCampaignStatus;
  createdAt: string;
  updatedAt: string;
  quoteId: string | null;
  windFarmId: string;
  windFarmName: string | null;
  windFarmLocation: string | null;
  turbineId: string | null;
  turbineName: string | null;
  turbineModel: string | null;
}

/** A defect being repaired in the campaign, as reported by get_repairs_for_quote. */
export interface RepairDefect {
  /** Real defect.id (falls back to the work_order id when no defect_id exists). */
  id: string;
  type: string;
  severity: number;
  side: string | null;
  distanceFromRoot: number;
  widthCm: number | null;
  heightCm: number | null;
  description: string | null;
  bladePosition: number;
  /** Per-blade sequential correlative (e.g. "A1", "A2", "B1"), matching the
   *  numbering shown in the Analyze step. Resolved via defect→inspection→blade. */
  defectNumber: string | null;
  /** Turbine name from the RPC (used as the blade/turbine label when no blade is known). */
  turbineName: string | null;
}

/** A repair photo (from get_repair_photos_by_stage → photos[]). */
export interface RepairPhoto {
  id: string;
  repairId: string | null;
  repairStageId: string | null;
  stageCode: string;
  storagePath: string;
  thumbnailPath: string | null;
  filename: string;
  captureOrder: number;
  capturedAt: string | null;
  /** Whether the photo is marked for the PDF report (repair_photo.metadata.selected_for_report). */
  repairSelected: boolean;
  /** Resolved public URL of the full-size photo (storage_path) for the lightbox. */
  url: string;
  /** Resolved public URL of the thumbnail (thumbnail_path) for the grid; falls back to url. */
  thumbnailUrl: string;
}

/** One repair stage (of the 11) with its photos, scoped to a single repair. */
export interface RepairStageNode {
  /** repair_stage_id from the RPC, null when using the catalog fallback. */
  stageId: string | null;
  stageCode: string;
  /** stage_label from the RPC, or the catalog label. */
  stageLabel: string;
  sortOrder: number;
  /** Optional per-stage note written by the technician (stage_note). */
  note: string | null;
  /** stage_status from the RPC, null when no repair yet. */
  status: string | null;
  photos: RepairPhoto[];
}

/** A defect with its full 11-stage repair cycle. */
export interface RepairDefectNode {
  defect: RepairDefect;
  /** The repair session id (= defect.id in the RPC model). */
  repairId: string | null;
  repairStatus: string | null;
  technicianName: string | null;
  stages: RepairStageNode[];
}

/** Full repair tree: defects[] → stages[] (the 11, ordered) → photos[]. */
export type RepairTree = RepairDefectNode[];

/** Summary data for the repair row in the campaigns panel. */
export interface RepairSummary {
  /** Turbine name (for the "Turbina" column — just the name, not the campaign). */
  turbineName: string | null;
  photosCount: number;
  selectedCount: number;
  defectsCount: number;
  stagesWithPhotos: number;
  totalStages: number;
  /** % of stages that carry at least one photo (0-100). */
  stagesProgressPercent: number;
  /** % of photos marked as viewed (kept for the panel column; always 0 in the new model). */
  viewedPercent: number;
  /** True if at least one repair session is completed. */
  hasCompletedRepair: boolean;
}

// ─── RPC row shapes ───────────────────────────────────────────────────────────

interface RepairForQuoteRow {
  repair_id: string;
  defect_type?: string | null;
  defect_severity?: number | null;
  turbine_name?: string | null;
  repair_status?: string | null;
  technician_name?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  total_photos?: number | null;
}

interface RepairStageRow {
  repair_stage_id: string;
  stage_code: string;
  stage_label?: string | null;
  stage_order?: number | null;
  stage_note?: string | null;
  stage_status?: string | null;
  photo_count?: number | null;
  photos?: unknown;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Resolve a public URL for a storage path in the public inspection-photos bucket. */
function publicUrl(storagePath: string | null): string {
  if (!storagePath) return '';
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl ?? '';
}

/** Whether a repair_photo.metadata marks the photo as selected for the report. */
function isSelectedForReport(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  return Boolean((metadata as Record<string, unknown>).selected_for_report);
}

/**
 * Call get_repairs_for_quote and return its rows. Empty array when no quote.
 */
async function fetchRepairsForQuote(quoteId: string | null): Promise<RepairForQuoteRow[]> {
  if (!quoteId) return [];
  const { data, error } = await db.rpc('get_repairs_for_quote', { quote_id_param: quoteId });
  if (error) throw new RepairServiceError(error.message, error.code);
  return ((data as unknown[]) ?? []) as RepairForQuoteRow[];
}

/** Blade position (1/2/3) + per-blade correlative (A1/A2/B1) per repair_id. */
interface RepairBladeInfo {
  bladePosition: number;
  defectNumber: string | null;
}

const BLADE_LETTERS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };

/**
 * Resolve the real blade position and the per-blade correlative (matching the
 * Analyze step's A1/A2/B1 numbering) for every repair of a quote.
 *
 * Chain (same as repairReportPdf.service.ts):
 *   repair_photos_detailed.repair_id → defect_id → defect.inspection_id
 *   → inspection.blade_id → blade.position (1/2/3 = A/B/C)
 *
 * The correlative is a per-blade sequential index. To match Analyze (which
 * counts annotations in order), we order defects within a blade by the
 * defect's creation time, then assign A1, A2, B1, ...
 */
async function resolveBladeInfoByRepair(
  quoteId: string | null,
): Promise<Map<string, RepairBladeInfo>> {
  const result = new Map<string, RepairBladeInfo>();
  if (!quoteId) return result;

  // 1. Map repair_id → defect_id from the view (one defect per repair node).
  const { data: viewRows } = await db
    .from('repair_photos_detailed')
    .select('repair_id, defect_id')
    .eq('quote_id', quoteId);

  const defectIdByRepair = new Map<string, string>();
  const defectIds = new Set<string>();
  for (const vr of (viewRows as unknown[]) ?? []) {
    const r = vr as Record<string, unknown>;
    const repairId = r.repair_id as string;
    const defectId = r.defect_id as string;
    if (repairId && defectId && !defectIdByRepair.has(repairId)) {
      defectIdByRepair.set(repairId, defectId);
    }
    if (defectId) defectIds.add(defectId);
  }
  if (defectIds.size === 0) return result;

  // 2. Load the defects (with inspection + creation order).
  const { data: defectRows } = await db
    .from('defect')
    .select('id, inspection_id, created_at')
    .in('id', [...defectIds]);

  const inspectionByDefect = new Map<string, string>();
  const createdAtByDefect = new Map<string, string>();
  const inspectionIds = new Set<string>();
  for (const dr of (defectRows as unknown[]) ?? []) {
    const r = dr as Record<string, unknown>;
    const id = r.id as string;
    const inspId = (r.inspection_id as string) ?? '';
    inspectionByDefect.set(id, inspId);
    createdAtByDefect.set(id, (r.created_at as string) ?? '');
    if (inspId) inspectionIds.add(inspId);
  }

  // 3. Resolve blade position per inspection.
  const positionByInspection = new Map<string, number>();
  if (inspectionIds.size > 0) {
    const { data: inspRows } = await db
      .from('inspection')
      .select('id, blade:blade_id ( position )')
      .in('id', [...inspectionIds]);
    for (const ir of (inspRows as unknown[]) ?? []) {
      const r = ir as Record<string, unknown>;
      const blade = (r.blade as Record<string, unknown>) ?? {};
      positionByInspection.set(r.id as string, Number(blade.position) || 0);
    }
  }

  // 4. Build per-blade correlatives (A1, A2, B1, ...). Order defects within a
  //    blade by creation time to match the Analyze step's annotation order.
  const defectsWithBlade = [...defectIdByRepair.entries()].map(([repairId, defectId]) => {
    const inspId = inspectionByDefect.get(defectId) ?? '';
    return {
      repairId,
      defectId,
      position: positionByInspection.get(inspId) ?? 0,
      createdAt: createdAtByDefect.get(defectId) ?? '',
    };
  });
  defectsWithBlade.sort(
    (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt),
  );

  const counters: Record<number, number> = {};
  for (const d of defectsWithBlade) {
    counters[d.position] = (counters[d.position] || 0) + 1;
    const letter = BLADE_LETTERS[d.position] ?? String(d.position);
    result.set(d.repairId, {
      bladePosition: d.position,
      defectNumber: d.position > 0 ? `${letter}${counters[d.position]}` : null,
    });
  }
  return result;
}

/**
 * Resolve the real blade position and the per-blade correlative (A1/A2/B1)
 * directly for a set of defect ids, matching the Analyze step's numbering.
 *
 * Chain: defect.inspection_id → inspection.blade_id → blade.position (1/2/3 = A/B/C).
 * The correlative is a per-blade sequential index; defects within a blade are
 * ordered by their creation time to match the Analyze annotation order.
 *
 * Unlike resolveBladeInfoByRepair, this keys the result by defect_id, so it
 * works for ALL defects of a campaign (including those without a repair yet).
 */
async function resolveBladeInfoByDefect(
  defectIds: string[],
): Promise<Map<string, RepairBladeInfo>> {
  const result = new Map<string, RepairBladeInfo>();
  const unique = [...new Set(defectIds.filter(Boolean))];
  if (unique.length === 0) return result;

  // 1. Load the defects (with inspection + creation order).
  const { data: defectRows } = await db
    .from('defect')
    .select('id, inspection_id, created_at')
    .in('id', unique);

  const inspectionByDefect = new Map<string, string>();
  const createdAtByDefect = new Map<string, string>();
  const inspectionIds = new Set<string>();
  for (const dr of (defectRows as unknown[]) ?? []) {
    const r = dr as Record<string, unknown>;
    const id = r.id as string;
    const inspId = (r.inspection_id as string) ?? '';
    inspectionByDefect.set(id, inspId);
    createdAtByDefect.set(id, (r.created_at as string) ?? '');
    if (inspId) inspectionIds.add(inspId);
  }

  // 2. Resolve blade position per inspection.
  const positionByInspection = new Map<string, number>();
  if (inspectionIds.size > 0) {
    const { data: inspRows } = await db
      .from('inspection')
      .select('id, blade:blade_id ( position )')
      .in('id', [...inspectionIds]);
    for (const ir of (inspRows as unknown[]) ?? []) {
      const r = ir as Record<string, unknown>;
      const blade = (r.blade as Record<string, unknown>) ?? {};
      positionByInspection.set(r.id as string, Number(blade.position) || 0);
    }
  }

  // 3. Build per-blade correlatives (A1, A2, B1, ...). Order defects within a
  //    blade by creation time to match the Analyze step's annotation order.
  const defectsWithBlade = unique.map((defectId) => {
    const inspId = inspectionByDefect.get(defectId) ?? '';
    return {
      defectId,
      position: positionByInspection.get(inspId) ?? 0,
      createdAt: createdAtByDefect.get(defectId) ?? '',
    };
  });
  defectsWithBlade.sort(
    (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt),
  );

  const counters: Record<number, number> = {};
  for (const d of defectsWithBlade) {
    counters[d.position] = (counters[d.position] || 0) + 1;
    const letter = BLADE_LETTERS[d.position] ?? String(d.position);
    result.set(d.defectId, {
      bladePosition: d.position,
      defectNumber: d.position > 0 ? `${letter}${counters[d.position]}` : null,
    });
  }
  return result;
}

/**
 * Call get_repair_photos_by_stage for one repair and return its stage rows
 * (the 11 stages in order, each with a photos[] JSON array).
 */
async function fetchStagesForRepair(repairId: string): Promise<RepairStageRow[]> {
  const { data, error } = await db.rpc('get_repair_photos_by_stage', {
    repair_id_param: repairId,
  });
  if (error) throw new RepairServiceError(error.message, error.code);
  return ((data as unknown[]) ?? []) as RepairStageRow[];
}

/**
 * Read repair_photo.metadata for a set of photo ids and return the set of ids
 * that are selected_for_report. The RPCs are read-only and don't expose photo
 * metadata, so we resolve the selection state directly from repair_photo.
 */
async function fetchSelectedPhotoIds(photoIds: string[]): Promise<Set<string>> {
  const selected = new Set<string>();
  const unique = [...new Set(photoIds.filter(Boolean))];
  if (unique.length === 0) return selected;

  const { data, error } = await db
    .from('repair_photo')
    .select('id, metadata')
    .in('id', unique);
  if (error) throw new RepairServiceError(error.message, error.code);

  for (const row of (data as unknown[]) ?? []) {
    const r = row as Record<string, unknown>;
    if (isSelectedForReport(r.metadata)) selected.add(r.id as string);
  }
  return selected;
}

/** Map a raw photo object (from the RPC photos[] array) to a RepairPhoto. */
function mapPhoto(
  raw: Record<string, unknown>,
  repairId: string | null,
  repairStageId: string | null,
  stageCode: string,
  selectedIds: Set<string>,
): RepairPhoto {
  const id = (raw.photo_id as string) ?? '';
  const storagePath = (raw.storage_path as string) ?? '';
  const thumbnailPath = (raw.thumbnail_path as string) ?? null;
  const url = publicUrl(storagePath);
  const thumbnailUrl = thumbnailPath ? publicUrl(thumbnailPath) : url;
  return {
    id,
    repairId,
    repairStageId,
    stageCode,
    storagePath,
    thumbnailPath,
    filename: (raw.filename as string) ?? '',
    captureOrder: Number(raw.capture_order) || 0,
    capturedAt: (raw.captured_at as string) ?? null,
    repairSelected: selectedIds.has(id),
    url,
    thumbnailUrl,
  };
}

/** Parse the photos[] value from a stage row into an array of raw photo objects. */
function parsePhotosArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Collect all photo ids present across a repair's stage rows. */
function collectPhotoIds(stageRows: RepairStageRow[]): string[] {
  const ids: string[] = [];
  for (const stage of stageRows) {
    for (const p of parsePhotosArray(stage.photos)) {
      const id = p.photo_id as string | undefined;
      if (id) ids.push(id);
    }
  }
  return ids;
}

/**
 * Map a repair's stage rows (from get_repair_photos_by_stage) to RepairStageNode[],
 * resolving photo selection state from `selectedIds`.
 */
function mapStages(
  repairId: string,
  stageRows: RepairStageRow[],
  selectedIds: Set<string>,
): RepairStageNode[] {
  const nodes = stageRows.map((stage) => {
    const stageId = stage.repair_stage_id ?? null;
    const stageCode = stage.stage_code ?? '';
    const photos = parsePhotosArray(stage.photos)
      .map((p) => mapPhoto(p, repairId, stageId, stageCode, selectedIds))
      .sort((a, b) => a.captureOrder - b.captureOrder);
    return {
      stageId,
      stageCode,
      stageLabel: (stage.stage_label as string) ?? '',
      sortOrder: Number(stage.stage_order) || 0,
      note: (stage.stage_note as string) ?? null,
      status: (stage.stage_status as string) ?? null,
      photos,
    };
  });
  nodes.sort((a, b) => a.sortOrder - b.sortOrder);
  return nodes;
}

/** Build the 11 empty catalog stages for a repair with no stage data yet. */
function catalogStages(): RepairStageNode[] {
  return REPAIR_STAGE_CATALOG.map((c) => ({
    stageId: null,
    stageCode: c.code,
    stageLabel: c.labelEs,
    sortOrder: c.sortOrder,
    note: null,
    status: null,
    photos: [],
  }));
}

/** Map a get_repairs_for_quote row to a RepairDefect. Blade position and the
 *  per-blade correlative come from `bladeInfo` (resolved via the view/defect
 *  join), since the RPC itself carries no blade data. */
function mapDefect(row: RepairForQuoteRow, bladeInfo?: RepairBladeInfo): RepairDefect {
  return {
    id: row.repair_id,
    type: (row.defect_type as string) ?? 'other',
    severity: Number(row.defect_severity) || 0,
    side: null,
    distanceFromRoot: 0,
    widthCm: null,
    heightCm: null,
    description: null,
    bladePosition: bladeInfo?.bladePosition ?? 0,
    defectNumber: bladeInfo?.defectNumber ?? null,
    turbineName: (row.turbine_name as string) ?? null,
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

export const repairService = {
  /**
   * Get the repair campaign header data with turbine + wind farm.
   * (campaign + turbine + wind farm only — no photo access here.)
   */
  async getRepairCampaign(campaignId: string): Promise<RepairCampaignDetail> {
    const { data, error } = await db
      .from('campaign')
      .select(`
        id, name, status, quote_id, created_at, updated_at, wind_farm_id, turbine_id,
        wind_farm:wind_farm_id ( id, name, location ),
        turbine:turbine_id ( id, name, model )
      `)
      .eq('id', campaignId)
      .single();

    if (error || !data) {
      throw new RepairServiceError(error?.message || 'Repair campaign not found', error?.code);
    }

    const r = data as Record<string, unknown>;
    const wf = (r.wind_farm as Record<string, unknown>) ?? {};
    const turbine = (r.turbine as Record<string, unknown>) ?? {};

    return {
      id: r.id as string,
      name: r.name as string,
      status: ((r.status as string) ?? 'repair_open') as RepairCampaignStatus,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      quoteId: (r.quote_id as string) ?? null,
      windFarmId: r.wind_farm_id as string,
      windFarmName: (wf.name as string) ?? null,
      windFarmLocation: (wf.location as string) ?? null,
      turbineId: (r.turbine_id as string) ?? null,
      turbineName: (turbine.name as string) ?? null,
      turbineModel: (turbine.model as string) ?? null,
    };
  },

  /**
   * Build the full repair tree using the official RPCs:
   *   1. campaign.quote_id
   *   2. get_repairs_for_quote(quoteId)        → one node per repair/defect
   *   3. get_repair_photos_by_stage(repairId)  → the 11 stages + photos[]
   *
   * Photos come EXCLUSIVELY from the RPCs (repair_photo), never inspection_photo.
   * Selection state (metadata.selected_for_report) is resolved from repair_photo
   * by photo_id, since the read-only RPCs don't expose metadata.
   */
  async getRepairTree(campaignId: string): Promise<RepairTree> {
    // 1. Campaign → quote_id.
    const { data: campaign, error } = await db
      .from('campaign')
      .select('quote_id')
      .eq('id', campaignId)
      .single();

    if (error || !campaign) {
      throw new RepairServiceError(error?.message || 'Repair campaign not found', error?.code);
    }

    const quoteId = (campaign.quote_id as string) ?? null;
    if (!quoteId) return [];

    // 2. ALL work_orders of the quote (one per defect of the campaign).
    const { data: woRows, error: woErr } = await db
      .from('work_order')
      .select('id, defect_id, turbine_id, blade_side')
      .eq('quote_id', quoteId);
    if (woErr) throw new RepairServiceError(woErr.message, woErr.code);

    const workOrders = ((woRows as unknown[]) ?? []).map((w) => {
      const r = w as Record<string, unknown>;
      return {
        id: r.id as string,
        defectId: (r.defect_id as string) ?? null,
        turbineId: (r.turbine_id as string) ?? null,
        bladeSide: (r.blade_side as string) ?? null,
      };
    });
    if (workOrders.length === 0) return [];

    const workOrderIds = workOrders.map((w) => w.id).filter(Boolean);
    const defectIds = [
      ...new Set(workOrders.map((w) => w.defectId).filter((id): id is string => Boolean(id))),
    ];

    // 3. Repairs of those work_orders → Map<work_order_id, repairRow>.
    const repairByWorkOrder = new Map<string, Record<string, unknown>>();
    if (workOrderIds.length > 0) {
      const { data: repairRows, error: repErr } = await db
        .from('repair')
        .select('id, work_order_id, defect_id, status, technician_id')
        .in('work_order_id', workOrderIds);
      if (repErr) throw new RepairServiceError(repErr.message, repErr.code);
      for (const rr of (repairRows as unknown[]) ?? []) {
        const r = rr as Record<string, unknown>;
        const woId = r.work_order_id as string;
        if (woId && !repairByWorkOrder.has(woId)) repairByWorkOrder.set(woId, r);
      }
    }

    // 4. Real defect rows → Map<defect_id, defectRow>.
    const defectById = new Map<string, Record<string, unknown>>();
    if (defectIds.length > 0) {
      const { data: defectRows, error: defErr } = await db
        .from('defect')
        .select(
          'id, type, severity, side, distance_from_root, width_cm, height_cm, description, inspection_id, created_at, defect_number',
        )
        .in('id', defectIds);
      if (defErr) throw new RepairServiceError(defErr.message, defErr.code);
      for (const dr of (defectRows as unknown[]) ?? []) {
        const r = dr as Record<string, unknown>;
        defectById.set(r.id as string, r);
      }
    }

    // 5. Blade position + correlative (A27/A28/B4...) resolved via the SHARED
    //    numbering module, so the repair workflow shows EXACTLY the same code as
    //    the quote (the source of truth). The numbering counts ALL annotations
    //    of the whole campaign; the defect ↔ annotation link is
    //    `defect.description` = annotation.id (a 36-char UUID).
    //
    //    We seed buildCampaignAnnotationCodeMap with the inspection ids of the
    //    repair's defects; the function expands to the full campaign internally.
    const repairInspectionIds = [
      ...new Set(
        [...defectById.values()]
          .map((d) => (d.inspection_id as string) ?? '')
          .filter(Boolean),
      ),
    ];
    const { codeMap: annotationCodeMap, bladeMap: annotationBladeMap } =
      repairInspectionIds.length > 0
        ? await buildCampaignAnnotationCodeMap(repairInspectionIds)
        : { codeMap: new Map<string, string>(), bladeMap: new Map<string, string>() };

    // Fallback (per-defect counting from 1) ONLY for defects whose description
    // is not a valid annotation UUID, so we never lose a number.
    const bladeInfoByDefect = await resolveBladeInfoByDefect(defectIds);

    // Reverse map blade letter (A/B/C) → position (1/2/3) to keep bladePosition
    // consistent with the annotation-derived code.
    const positionByLetter = new Map<string, number>();
    for (const [pos, letter] of Object.entries(ANNOTATION_BLADE_LETTERS)) {
      positionByLetter.set(letter, Number(pos));
    }

    /**
     * Resolve { defectNumber, bladePosition } for a defect, preferring the
     * shared annotation numbering (A27/A28) and falling back to the per-defect
     * resolver when the defect has no valid annotation link.
     */
    const numberingForDefect = (
      defectId: string | null,
    ): { defectNumber: string | null; bladePosition: number } => {
      const fallback = defectId ? bladeInfoByDefect.get(defectId) : undefined;
      const defectRow = defectId ? defectById.get(defectId) : undefined;
      const annId = (defectRow?.description as string) ?? '';

      // SOURCE OF TRUTH: defect.defect_number persisted by the recompute RPC.
      // When present, derive the blade position from its letter prefix so the
      // label matches the code (e.g. "A27" → blade A). Fall through to the
      // runtime annotation numbering only when the column is null (older
      // defects not yet recomputed), preserving the previous behaviour.
      const persisted = (defectRow?.defect_number as string) ?? null;
      if (persisted) {
        const letter = persisted.charAt(0);
        const pos = positionByLetter.get(letter);
        return {
          defectNumber: persisted,
          bladePosition: pos ?? fallback?.bladePosition ?? 0,
        };
      }

      if (annId && isUuid(annId)) {
        const code = annotationCodeMap.get(annId);
        if (code) {
          const letter = annotationBladeMap.get(annId);
          const pos = letter ? positionByLetter.get(letter) : undefined;
          return {
            defectNumber: code,
            bladePosition: pos ?? fallback?.bladePosition ?? 0,
          };
        }
      }
      return {
        defectNumber: fallback?.defectNumber ?? null,
        bladePosition: fallback?.bladePosition ?? 0,
      };
    };

    // 6. Turbine names for the turbines referenced by the work_orders.
    const turbineNameById = new Map<string, string>();
    const turbineIds = [
      ...new Set(workOrders.map((w) => w.turbineId).filter((id): id is string => Boolean(id))),
    ];
    if (turbineIds.length > 0) {
      const { data: turbineRows } = await db
        .from('turbine')
        .select('id, name')
        .in('id', turbineIds);
      for (const tr of (turbineRows as unknown[]) ?? []) {
        const r = tr as Record<string, unknown>;
        turbineNameById.set(r.id as string, (r.name as string) ?? '');
      }
    }

    // 7. Fetch stages+photos only for work_orders that HAVE a repair (parallel).
    const stagesByRepair = new Map<string, RepairStageRow[]>();
    await Promise.all(
      [...repairByWorkOrder.values()].map(async (repair) => {
        const repairId = repair.id as string;
        stagesByRepair.set(repairId, await fetchStagesForRepair(repairId));
      }),
    );

    // 8. Resolve selection state for every photo id across all repairs in one query.
    const allPhotoIds: string[] = [];
    for (const rows of stagesByRepair.values()) {
      allPhotoIds.push(...collectPhotoIds(rows));
    }
    const selectedIds = await fetchSelectedPhotoIds(allPhotoIds);

    // 9. Build one node per work_order (i.e. per defect of the campaign),
    //    keeping the defect's created_at alongside for the final ordering.
    const built = workOrders.map((wo) => {
      const repairRow = repairByWorkOrder.get(wo.id);
      const defectRow = wo.defectId ? defectById.get(wo.defectId) : undefined;
      const numbering = numberingForDefect(wo.defectId);

      const repairId = repairRow ? (repairRow.id as string) : null;
      const repairStatus = repairRow ? ((repairRow.status as string) ?? null) : null;
      const stages = repairId
        ? mapStages(repairId, stagesByRepair.get(repairId) ?? [], selectedIds)
        : catalogStages();

      const defect: RepairDefect = {
        id: wo.defectId ?? wo.id,
        type: (defectRow?.type as string) ?? 'other',
        severity: Number(defectRow?.severity) || 0,
        side: (defectRow?.side as string) ?? wo.bladeSide ?? null,
        distanceFromRoot: Number(defectRow?.distance_from_root) || 0,
        widthCm: defectRow?.width_cm != null ? Number(defectRow.width_cm) : null,
        heightCm: defectRow?.height_cm != null ? Number(defectRow.height_cm) : null,
        description: (defectRow?.description as string) ?? null,
        bladePosition: numbering.bladePosition,
        defectNumber: numbering.defectNumber,
        turbineName: wo.turbineId ? (turbineNameById.get(wo.turbineId) ?? null) : null,
      };

      const node: RepairDefectNode = {
        defect,
        repairId,
        repairStatus,
        technicianName: null,
        stages: stages.length > 0 ? stages : catalogStages(),
      };
      return { node, createdAt: (defectRow?.created_at as string) ?? '' };
    });

    // 10. Order by (bladePosition, defect.created_at) for correlative consistency.
    built.sort((a, b) => {
      const posDiff = a.node.defect.bladePosition - b.node.defect.bladePosition;
      if (posDiff !== 0) return posDiff;
      return a.createdAt.localeCompare(b.createdAt);
    });

    return built.map((b) => b.node);
  },

  /**
   * Toggle whether a photo is selected for the repair report. The RPCs are
   * read-only, so selection is persisted by merging metadata.selected_for_report
   * into repair_photo.metadata (jsonb), reading the current metadata first so we
   * don't drop other keys.
   */
  async setPhotoSelected(photoId: string, selected: boolean): Promise<void> {
    const { data: current, error: readErr } = await db
      .from('repair_photo')
      .select('metadata')
      .eq('id', photoId)
      .single();

    if (readErr) throw new RepairServiceError(readErr.message, readErr.code);

    const metadata = {
      ...(((current?.metadata as Record<string, unknown>) ?? {})),
      selected_for_report: selected,
    };

    const { error } = await db
      .from('repair_photo')
      .update({ metadata })
      .eq('id', photoId);

    if (error) throw new RepairServiceError(error.message, error.code);
  },

  /**
   * Aggregate summary for the repair row in the campaigns panel:
   * defects (= repairs from get_repairs_for_quote), total repair photos
   * (sum of total_photos), and completion (any repair_status='completed').
   * Stage-level progress is derived from get_repair_photos_by_stage.
   */
  async getRepairSummary(campaignId: string): Promise<RepairSummary> {
    const { data: campaign } = await db
      .from('campaign')
      .select('quote_id, turbine:turbine_id ( name )')
      .eq('id', campaignId)
      .single();

    const turbineName =
      ((campaign?.turbine as Record<string, unknown> | null)?.name as string) ?? null;

    const quoteId = (campaign?.quote_id as string) ?? null;

    // defectsCount = ALL defects of the campaign (one work_order per defect),
    // not only those that already have a repair row.
    let defectsCount = 0;
    if (quoteId) {
      const { data: woRows, error: woErr } = await db
        .from('work_order')
        .select('id')
        .eq('quote_id', quoteId);
      if (woErr) throw new RepairServiceError(woErr.message, woErr.code);
      defectsCount = ((woRows as unknown[]) ?? []).length;
    }

    // Photos + completion are still derived from the existing repairs.
    const repairs = await fetchRepairsForQuote(quoteId);
    const totalStages = (defectsCount > 0 ? defectsCount : 1) * REPAIR_STAGE_CATALOG.length;

    let photosCount = 0;
    let hasCompletedRepair = false;
    for (const repair of repairs) {
      photosCount += Number(repair.total_photos) || 0;
      if ((repair.repair_status as string) === 'completed') hasCompletedRepair = true;
    }

    // Per-stage detail (stages with photos + selection count) from the RPC.
    let stagesWithPhotos = 0;
    const allPhotoIds: string[] = [];
    if (defectsCount > 0) {
      const stageRowsByRepair = await Promise.all(
        repairs.map((r) => fetchStagesForRepair(r.repair_id)),
      );
      for (const rows of stageRowsByRepair) {
        for (const stage of rows) {
          const photos = parsePhotosArray(stage.photos);
          if (photos.length > 0) stagesWithPhotos += 1;
          for (const p of photos) {
            const id = p.photo_id as string | undefined;
            if (id) allPhotoIds.push(id);
          }
        }
      }
    }

    const selectedIds = await fetchSelectedPhotoIds(allPhotoIds);
    const selectedCount = selectedIds.size;

    return {
      turbineName,
      photosCount,
      selectedCount,
      defectsCount,
      stagesWithPhotos,
      totalStages,
      stagesProgressPercent:
        totalStages > 0 ? Math.round((stagesWithPhotos / totalStages) * 100) : 0,
      viewedPercent: 0,
      hasCompletedRepair,
    };
  },

  /**
   * Update the repair campaign workflow status.
   */
  async updateRepairStatus(campaignId: string, status: RepairCampaignStatus): Promise<void> {
    const { error } = await db
      .from('campaign')
      .update({ status })
      .eq('id', campaignId);

    if (error) {
      throw new RepairServiceError(error.message, error.code);
    }
  },
};
