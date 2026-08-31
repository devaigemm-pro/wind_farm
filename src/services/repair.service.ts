import { supabase } from '@/lib/supabase';
import { REPAIR_STAGE_CATALOG } from '@/constants/repair-stages';
import type { RepairCampaignStatus } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// The technician app writes repair photos under the PUBLIC 'inspection-photos'
// bucket at repairs/{repair_id}/{stage_code}/{filename}. repair_photo.storage_path
// already holds the full path relative to the bucket, so we resolve public URLs.
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

/** A defect being repaired in the campaign (via work_order → defect). */
export interface RepairDefect {
  id: string;
  workOrderId: string;
  type: string;
  severity: number;
  side: string | null;
  distanceFromRoot: number;
  widthCm: number | null;
  heightCm: number | null;
  description: string | null;
  bladePosition: number;
}

/** A repair photo (repair_photo row). */
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
  /** Whether the photo is marked for the PDF report (metadata.selected_for_report). */
  repairSelected: boolean;
  /** Resolved public URL of the full-size photo (storage_path) for the lightbox. */
  url: string;
  /** Resolved public URL of the thumbnail (thumbnail_path) for the grid; falls back to url. */
  thumbnailUrl: string;
}

/** One repair stage (of the 11) with its photos, scoped to a single defect/repair. */
export interface RepairStageNode {
  /** repair_stage.id when the repair exists, null when using the catalog fallback. */
  stageId: string | null;
  stageCode: string;
  /** repair_stage.stage_label, or the catalog label. */
  stageLabel: string;
  sortOrder: number;
  /** Optional per-stage note written by the technician. */
  note: string | null;
  /** repair_stage.status ('pending' | 'in_progress' | 'done'), null when no repair yet. */
  status: string | null;
  photos: RepairPhoto[];
}

/** A defect with its full 11-stage repair cycle. */
export interface RepairDefectNode {
  defect: RepairDefect;
  /** The repair session for this work_order, if the technician already started it. */
  repairId: string | null;
  repairStatus: string | null;
  technicianName: string | null;
  stages: RepairStageNode[];
}

/** Full repair tree: defects[] → stages[] (the 11, ordered) → photos[]. */
export type RepairTree = RepairDefectNode[];

/** Summary data for the repair row in the campaigns panel. */
export interface RepairSummary {
  photosCount: number;
  selectedCount: number;
  defectsCount: number;
  stagesWithPhotos: number;
  totalStages: number;
  /** % of stages that are done or carry at least one photo (0-100). */
  stagesProgressPercent: number;
  /** % of photos marked as viewed (kept for the panel column; always 0 in the new model). */
  viewedPercent: number;
  /** True if at least one repair session is completed. */
  hasCompletedRepair: boolean;
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

/** Map a raw repair_photo row (with resolved URLs) to a RepairPhoto. */
function mapPhoto(row: Record<string, unknown>, repairId: string | null): RepairPhoto {
  const storagePath = (row.storage_path as string) ?? '';
  const thumbnailPath = (row.thumbnail_path as string) ?? null;
  const url = publicUrl(storagePath);
  const thumbnailUrl = thumbnailPath ? publicUrl(thumbnailPath) : url;
  return {
    id: row.id as string,
    repairId,
    repairStageId: (row.repair_stage_id as string) ?? null,
    stageCode: (row.stage_code as string) ?? '',
    storagePath,
    thumbnailPath,
    filename: (row.filename as string) ?? '',
    captureOrder: Number(row.capture_order) || 0,
    capturedAt: (row.captured_at as string) ?? null,
    repairSelected: isSelectedForReport(row.metadata),
    url,
    thumbnailUrl,
  };
}

interface WorkOrderWithDefect {
  workOrderId: string;
  defect: RepairDefect;
}

/**
 * Fetch the work_orders of a repair campaign via its approved quote, each with
 * its linked defect (+ the defect's blade via inspection). Ordered by blade
 * position then defect id (stable). campaign.quote_id → work_order (quote_id) →
 * defect (work_order.defect_id).
 */
async function fetchWorkOrdersWithDefects(quoteId: string | null): Promise<WorkOrderWithDefect[]> {
  if (!quoteId) return [];

  const { data: workOrders, error: woErr } = await db
    .from('work_order')
    .select('id, defect_id')
    .eq('quote_id', quoteId);

  if (woErr) throw new RepairServiceError(woErr.message, woErr.code);

  const rows = ((workOrders as unknown[]) ?? []).map((w) => {
    const r = w as Record<string, unknown>;
    return { workOrderId: r.id as string, defectId: (r.defect_id as string) ?? null };
  });

  const defectIds = rows.map((r) => r.defectId).filter((id): id is string => !!id);
  if (defectIds.length === 0) return [];

  const { data: defectRows, error: defErr } = await db
    .from('defect')
    .select(`
      id, type, severity, side, distance_from_root, width_cm, height_cm, description,
      inspection:inspection ( blade:blade ( position ) )
    `)
    .in('id', defectIds);

  if (defErr) throw new RepairServiceError(defErr.message, defErr.code);

  const defectById = new Map<string, Record<string, unknown>>();
  for (const d of (defectRows as unknown[]) ?? []) {
    const r = d as Record<string, unknown>;
    defectById.set(r.id as string, r);
  }

  const result: WorkOrderWithDefect[] = [];
  for (const wo of rows) {
    if (!wo.defectId) continue;
    const d = defectById.get(wo.defectId);
    if (!d) continue;
    const inspection = (d.inspection as Record<string, unknown>) ?? {};
    const blade = (inspection.blade as Record<string, unknown>) ?? {};
    result.push({
      workOrderId: wo.workOrderId,
      defect: {
        id: d.id as string,
        workOrderId: wo.workOrderId,
        type: (d.type as string) ?? 'other',
        severity: Number(d.severity) || 0,
        side: (d.side as string) ?? null,
        distanceFromRoot: Number(d.distance_from_root) || 0,
        widthCm: d.width_cm != null ? Number(d.width_cm) : null,
        heightCm: d.height_cm != null ? Number(d.height_cm) : null,
        description: (d.description as string) ?? null,
        bladePosition: Number(blade.position) || 1,
      },
    });
  }

  result.sort((a, b) => {
    if (a.defect.bladePosition !== b.defect.bladePosition) {
      return a.defect.bladePosition - b.defect.bladePosition;
    }
    return a.defect.id.localeCompare(b.defect.id);
  });

  return result;
}

/**
 * Fetch the repair sessions (repair rows) for a set of work_order ids, keyed by
 * work_order_id. One repair per work_order.
 */
async function fetchRepairsByWorkOrder(
  workOrderIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (workOrderIds.length === 0) return map;

  const { data, error } = await db
    .from('repair')
    .select('id, work_order_id, defect_id, technician_id, status, current_stage, started_at, completed_at')
    .in('work_order_id', workOrderIds);

  if (error) throw new RepairServiceError(error.message, error.code);

  for (const row of (data as unknown[]) ?? []) {
    const r = row as Record<string, unknown>;
    map.set(r.work_order_id as string, r);
  }
  return map;
}

/** Resolve technician display names for a set of profile ids. */
async function fetchTechnicianNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data } = await db.from('profiles').select('id, name, email').in('id', unique);
  for (const row of (data as unknown[]) ?? []) {
    const r = row as Record<string, unknown>;
    const name = (r.name as string) || (r.email as string) || '';
    if (name) map.set(r.id as string, name);
  }
  return map;
}

/**
 * Fetch the stages (+ photos) of a single repair, ordered by sort_order and
 * capture_order. One PostgREST query with an embedded repair_photo select.
 */
async function fetchStagesForRepair(repairId: string): Promise<RepairStageNode[]> {
  const { data, error } = await db
    .from('repair_stage')
    .select(`
      id, stage_code, stage_label, sort_order, note, status,
      repair_photo ( id, repair_stage_id, stage_code, storage_path, thumbnail_path, filename, capture_order, captured_at, metadata )
    `)
    .eq('repair_id', repairId)
    .order('sort_order', { ascending: true });

  if (error) throw new RepairServiceError(error.message, error.code);

  return ((data as unknown[]) ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const rawPhotos = ((r.repair_photo as unknown[]) ?? []).map((p) =>
      mapPhoto(p as Record<string, unknown>, repairId),
    );
    rawPhotos.sort((a, b) => a.captureOrder - b.captureOrder);
    return {
      stageId: r.id as string,
      stageCode: (r.stage_code as string) ?? '',
      stageLabel: (r.stage_label as string) ?? '',
      sortOrder: Number(r.sort_order) || 0,
      note: (r.note as string) ?? null,
      status: (r.status as string) ?? null,
      photos: rawPhotos,
    };
  });
}

/** Build the 11 empty catalog stages for a defect that has no repair yet. */
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

// ─── Service ────────────────────────────────────────────────────────────────

export const repairService = {
  /**
   * Get the repair campaign header data with turbine + wind farm.
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
   * Build the full repair tree following the new data model:
   *   campaign.quote_id → work_order (quote_id) → repair (work_order_id)
   *   → repair_stage (repair_id) → repair_photo (repair_stage_id).
   *
   * For each work_order/defect:
   *   - if its `repair` exists, use its 11 repair_stage rows (with labels, notes,
   *     status) and their repair_photo rows;
   *   - if no repair yet (technician hasn't started), fall back to the 11 empty
   *     catalog stages so the UI shows placeholders without breaking.
   */
  async getRepairTree(campaignId: string): Promise<RepairTree> {
    const { data: campaign, error } = await db
      .from('campaign')
      .select('quote_id')
      .eq('id', campaignId)
      .single();

    if (error || !campaign) {
      throw new RepairServiceError(error?.message || 'Repair campaign not found', error?.code);
    }

    const workOrders = await fetchWorkOrdersWithDefects((campaign.quote_id as string) ?? null);
    if (workOrders.length === 0) return [];

    const repairsByWo = await fetchRepairsByWorkOrder(workOrders.map((w) => w.workOrderId));

    const technicianIds: string[] = [];
    for (const repair of repairsByWo.values()) {
      const tid = repair.technician_id as string | null;
      if (tid) technicianIds.push(tid);
    }
    const technicianNames = await fetchTechnicianNames(technicianIds);

    // Fetch every repair's stages+photos in parallel.
    const stagesByRepair = new Map<string, RepairStageNode[]>();
    await Promise.all(
      [...repairsByWo.values()].map(async (repair) => {
        const repairId = repair.id as string;
        stagesByRepair.set(repairId, await fetchStagesForRepair(repairId));
      }),
    );

    return workOrders.map((wo) => {
      const repair = repairsByWo.get(wo.workOrderId) ?? null;
      const repairId = repair ? (repair.id as string) : null;
      const stages = repairId ? stagesByRepair.get(repairId) ?? [] : [];
      const technicianId = repair ? ((repair.technician_id as string) ?? null) : null;

      return {
        defect: wo.defect,
        repairId,
        repairStatus: repair ? ((repair.status as string) ?? null) : null,
        technicianName: technicianId ? technicianNames.get(technicianId) ?? null : null,
        // Use the repair's stages when present; otherwise the empty catalog.
        stages: stages.length > 0 ? stages : catalogStages(),
      };
    });
  },

  /**
   * Toggle whether a photo is selected for the repair report. The new model has
   * no dedicated column, so selection is persisted by merging
   * metadata.selected_for_report into repair_photo.metadata (jsonb).
   */
  async setPhotoSelected(photoId: string, selected: boolean): Promise<void> {
    // Read current metadata so we merge instead of overwriting other keys.
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
   * defects (= work_orders of the quote), total repair_photo, stages with photos,
   * and progress (stages done or carrying photos).
   */
  async getRepairSummary(campaignId: string): Promise<RepairSummary> {
    const { data: campaign } = await db
      .from('campaign')
      .select('quote_id')
      .eq('id', campaignId)
      .single();

    const workOrders = await fetchWorkOrdersWithDefects((campaign?.quote_id as string) ?? null);
    const defectsCount = workOrders.length;
    const totalStages = (defectsCount > 0 ? defectsCount : 1) * REPAIR_STAGE_CATALOG.length;

    const repairsByWo = await fetchRepairsByWorkOrder(workOrders.map((w) => w.workOrderId));
    const repairIds = [...repairsByWo.values()].map((r) => r.id as string);

    let photosCount = 0;
    let selectedCount = 0;
    let stagesWithPhotos = 0;
    let stagesDone = 0;
    let hasCompletedRepair = false;

    for (const repair of repairsByWo.values()) {
      if ((repair.status as string) === 'completed') hasCompletedRepair = true;
    }

    if (repairIds.length > 0) {
      // Count photos + selected (from metadata) across all repairs.
      const { data: photoRows, error: photoErr } = await db
        .from('repair_photo')
        .select('id, repair_stage_id, metadata')
        .in('repair_id', repairIds);
      if (photoErr) throw new RepairServiceError(photoErr.message, photoErr.code);

      const stageIdsWithPhotos = new Set<string>();
      for (const p of (photoRows as unknown[]) ?? []) {
        const r = p as Record<string, unknown>;
        photosCount += 1;
        if (isSelectedForReport(r.metadata)) selectedCount += 1;
        const sid = r.repair_stage_id as string | null;
        if (sid) stageIdsWithPhotos.add(sid);
      }
      stagesWithPhotos = stageIdsWithPhotos.size;

      // Count stages marked done (progress reflects technician progress too).
      const { data: stageRows } = await db
        .from('repair_stage')
        .select('id, status')
        .in('repair_id', repairIds);
      const doneStageIds = new Set<string>();
      for (const s of (stageRows as unknown[]) ?? []) {
        const r = s as Record<string, unknown>;
        if ((r.status as string) === 'done') doneStageIds.add(r.id as string);
      }
      // A stage counts as "progressed" if it's done OR has photos.
      const progressed = new Set<string>([...doneStageIds, ...stageIdsWithPhotos]);
      stagesDone = progressed.size;
    }

    return {
      photosCount,
      selectedCount,
      defectsCount,
      stagesWithPhotos,
      totalStages,
      stagesProgressPercent: totalStages > 0 ? Math.round((stagesDone / totalStages) * 100) : 0,
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
