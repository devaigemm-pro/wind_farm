import { supabase } from '@/lib/supabase';
import { REPAIR_STAGE_CATALOG } from '@/constants/repair-stages';
import type { RepairCampaignStatus } from '@/types';

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
  /** repair_id from the RPC (identifies the repair/defect node). */
  id: string;
  type: string;
  severity: number;
  side: string | null;
  distanceFromRoot: number;
  widthCm: number | null;
  heightCm: number | null;
  description: string | null;
  bladePosition: number;
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

/** Map a get_repairs_for_quote row to a RepairDefect. */
function mapDefect(row: RepairForQuoteRow): RepairDefect {
  return {
    id: row.repair_id,
    type: (row.defect_type as string) ?? 'other',
    severity: Number(row.defect_severity) || 0,
    side: null,
    distanceFromRoot: 0,
    widthCm: null,
    heightCm: null,
    description: null,
    // The RPC doesn't carry a blade position; default to 1. turbine_name is used
    // as the label in the UI/PDF where a blade name isn't available.
    bladePosition: 1,
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
    const { data: campaign, error } = await db
      .from('campaign')
      .select('quote_id')
      .eq('id', campaignId)
      .single();

    if (error || !campaign) {
      throw new RepairServiceError(error?.message || 'Repair campaign not found', error?.code);
    }

    const repairs = await fetchRepairsForQuote((campaign.quote_id as string) ?? null);
    if (repairs.length === 0) return [];

    // Fetch every repair's stages+photos in parallel via the RPC.
    const stagesByRepair = new Map<string, RepairStageRow[]>();
    await Promise.all(
      repairs.map(async (repair) => {
        stagesByRepair.set(repair.repair_id, await fetchStagesForRepair(repair.repair_id));
      }),
    );

    // Resolve selection state for every photo id across all repairs in one query.
    const allPhotoIds: string[] = [];
    for (const rows of stagesByRepair.values()) {
      allPhotoIds.push(...collectPhotoIds(rows));
    }
    const selectedIds = await fetchSelectedPhotoIds(allPhotoIds);

    return repairs.map((repair) => {
      const stageRows = stagesByRepair.get(repair.repair_id) ?? [];
      const stages = mapStages(repair.repair_id, stageRows, selectedIds);
      return {
        defect: mapDefect(repair),
        repairId: repair.repair_id,
        repairStatus: (repair.repair_status as string) ?? null,
        technicianName: (repair.technician_name as string) ?? null,
        stages: stages.length > 0 ? stages : catalogStages(),
      };
    });
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
      .select('quote_id')
      .eq('id', campaignId)
      .single();

    const repairs = await fetchRepairsForQuote((campaign?.quote_id as string) ?? null);
    const defectsCount = repairs.length;
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
