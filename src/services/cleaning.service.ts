import { supabase } from '@/lib/supabase';
import { fetchInChunks, DEFAULT_CHUNK_SIZE } from '@/utils/chunk';
import {
  CLEANING_ROOT_ZONES,
  CLEANING_ZONE_BY_CODE,
  getCleaningSubZones,
} from '@/constants/cleaning-zones';
import type { CleaningCampaignStatus } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Cleaning ("Limpieza de Turbina") web-side service.
 *
 * MIRRORS repair.service.ts, but for CLEANING campaigns: the structure is a
 * hierarchy of fixed ZONES (Palas / Nacelle / Hub / Torre) with sub-zones,
 * instead of a defect→21-stage tree. There are NO defects, severities, OCR, or
 * technician-progress fields — cleaning only has zones + photos + selection.
 *
 * ─── DATA CONTRACT (written by the TECHNICIAN MOBILE APP, read-only here) ────
 *
 * The web app NEVER writes cleaning photos. The mobile team owns these objects
 * and will create them; this service assumes the SAME shape as the repair
 * contract, renamed to `cleaning`:
 *
 *   • RPC  get_cleaning_photos_by_zone(campaign_id_param uuid)
 *       Read-only. Returns one row per zone that has photos, shaped like
 *       get_repair_photos_by_stage:
 *         {
 *           cleaning_zone_id uuid,      -- row id of the zone instance
 *           zone_code       text,       -- matches cleaning-zones.ts `code`
 *           zone_label      text|null,  -- optional display label
 *           zone_order      int|null,
 *           photo_count     int|null,
 *           photos          jsonb       -- array of photo objects (see below)
 *         }
 *       Each `photos[]` element:
 *         {
 *           photo_id       uuid,
 *           storage_path   text,        -- path in the PUBLIC 'inspection-photos' bucket
 *           thumbnail_path text|null,
 *           filename       text,
 *           capture_order  int,
 *           captured_at    timestamptz|null
 *         }
 *
 *   • TABLE cleaning_photo
 *       id                uuid pk
 *       campaign_id       uuid  -> campaign.id (type='cleaning')
 *       cleaning_zone_id  uuid|null
 *       zone_code         text  -- matches cleaning-zones.ts `code`
 *       storage_path      text
 *       thumbnail_path    text|null
 *       filename          text
 *       capture_order     int
 *       captured_at       timestamptz|null
 *       metadata          jsonb -- { selected_for_report: boolean }
 *
 *   • STORAGE  PUBLIC bucket 'inspection-photos'
 *       Native cleaning photos live under:
 *         cleaning/{campaign_id}/{zone_code}/{filename}
 *       so storage_path resolves to a PUBLIC url (same as repairs/...).
 *
 * GRACEFUL DEGRADATION: if the RPC/table don't exist yet (the mobile team
 * hasn't shipped them), every read falls back to the EMPTY zone catalog so the
 * UI still renders the zone skeleton — exactly like repair's catalogStages().
 * Any error from the RPC or the metadata query is caught and swallowed.
 */
export class CleaningServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CleaningServiceError';
  }
}

const PHOTO_BUCKET = 'inspection-photos';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Aggregated cleaning campaign header (campaign + turbine + wind farm). */
export interface CleaningCampaignDetail {
  id: string;
  name: string;
  status: CleaningCampaignStatus;
  createdAt: string;
  updatedAt: string;
  windFarmId: string;
  windFarmName: string | null;
  windFarmLocation: string | null;
  turbineId: string | null;
  turbineName: string | null;
  turbineModel: string | null;
}

/** A cleaning photo (from get_cleaning_photos_by_zone → photos[]). */
export interface CleaningPhoto {
  id: string;
  /** Row id of the zone instance this photo belongs to (null for catalog fallback). */
  cleaningZoneId: string | null;
  /** Zone code (matches cleaning-zones.ts). */
  zoneCode: string;
  storagePath: string;
  thumbnailPath: string | null;
  filename: string;
  captureOrder: number;
  capturedAt: string | null;
  /** metadata.selected_for_report. */
  cleaningSelected: boolean;
  /** Manual position in the report (metadata.report_order), set by dragging.
   *  Null = never reordered (falls back to captureOrder). */
  reportOrder: number | null;
  /** Resolved public URL of the full-size photo (for the lightbox). */
  url: string;
  /** Resolved public URL of the thumbnail (for the grid); falls back to url. */
  thumbnailUrl: string;
  /** Real uploader's name (storage owner via get_cleaning_photo_uploaders); null when unknown. */
  uploadedBy: string | null;
}

/**
 * One zone node of the cleaning tree. A ROOT zone (Palas / Nacelle / Hub /
 * Torre) may have `children` (sub-zones). A leaf node (sub-zone, or Hub / Torre)
 * carries its own `photos`. Container roots (Palas / Nacelle) carry no photos of
 * their own — their photos live in the children.
 */
export interface CleaningZoneNode {
  /** cleaning_zone_id from the RPC, null for the catalog fallback. */
  zoneId: string | null;
  zoneCode: string;
  zoneLabel: string;
  sortOrder: number;
  isRoot: boolean;
  isLeaf: boolean;
  photos: CleaningPhoto[];
  children: CleaningZoneNode[];
}

/** Full cleaning tree: ordered ROOT zones → sub-zones → photos. */
export type CleaningTree = CleaningZoneNode[];

/** Summary data for the cleaning row in the campaigns panel. */
export interface CleaningSummary {
  turbineName: string | null;
  photosCount: number;
  selectedCount: number;
  /** Number of leaf zones that carry at least one photo. */
  zonesWithPhotos: number;
  /** Total leaf zones (from the catalog). */
  totalZones: number;
  /** % of leaf zones that carry at least one photo (0-100). */
  zonesProgressPercent: number;
  /** Kept for panel-column parity with repair; always 0 in the cleaning model. */
  viewedPercent: number;
}

// ─── RPC row shapes ───────────────────────────────────────────────────────────

interface CleaningZoneRow {
  cleaning_zone_id?: string | null;
  zone_code?: string | null;
  zone_label?: string | null;
  zone_order?: number | null;
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

/** Whether a cleaning_photo.metadata marks the photo as selected for the report. */
function isSelectedForReport(metadata: unknown): boolean {
  let obj: unknown = metadata;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return false;
    }
  }
  if (!obj || typeof obj !== 'object') return false;
  return Boolean((obj as Record<string, unknown>).selected_for_report);
}

/** Manual position in the report (cleaning_photo.metadata.report_order), or null. */
function reportOrderFromMetadata(metadata: unknown): number | null {
  let obj: unknown = metadata;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const v = (obj as Record<string, unknown>).report_order;
  const n = typeof v === 'number' ? v : Number(v);
  return v != null && Number.isFinite(n) ? n : null;
}
/** Parse the photos[] value from a zone row into an array of raw photo objects. */
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

/** Map a raw photo object (from the RPC photos[] array) to a CleaningPhoto. */
function mapPhoto(
  raw: Record<string, unknown>,
  cleaningZoneId: string | null,
  zoneCode: string,
  selectedIds: Set<string>,
  reportOrderById?: Map<string, number>,
): CleaningPhoto {
  const id = (raw.photo_id as string) ?? '';
  const storagePath = (raw.storage_path as string) ?? '';
  const thumbnailPath = (raw.thumbnail_path as string) ?? null;
  const url = publicUrl(storagePath);
  const thumbnailUrl = thumbnailPath ? publicUrl(thumbnailPath) : url;
  return {
    id,
    cleaningZoneId,
    zoneCode,
    storagePath,
    thumbnailPath,
    filename: (raw.filename as string) ?? '',
    captureOrder: Number(raw.capture_order) || 0,
    capturedAt: (raw.captured_at as string) ?? null,
    cleaningSelected: selectedIds.has(id),
    reportOrder: reportOrderById?.get(id) ?? null,
    url,
    thumbnailUrl,
    uploadedBy: null,
  };
}

/**
 * Call get_cleaning_photos_by_zone for a campaign and return its zone rows.
 * Degrades gracefully to [] when the RPC doesn't exist yet or errors.
 */
async function fetchZonesForCampaign(campaignId: string): Promise<CleaningZoneRow[]> {
  try {
    const { data, error } = await db.rpc('get_cleaning_photos_by_zone', {
      campaign_id_param: campaignId,
    });
    if (error) return [];
    return ((data as unknown[]) ?? []) as CleaningZoneRow[];
  } catch {
    return [];
  }
}

/**
 * Read cleaning_photo.metadata for a set of photo ids and return the set that is
 * selected_for_report. Degrades gracefully to an empty set when the table
 * doesn't exist yet or errors.
 */
async function fetchPhotoReportMeta(
  photoIds: string[],
): Promise<{ selectedIds: Set<string>; reportOrderById: Map<string, number> }> {
  const selected = new Set<string>();
  const reportOrderById = new Map<string, number>();
  const unique = [...new Set(photoIds.filter(Boolean))];
  if (unique.length === 0) return { selectedIds: selected, reportOrderById };
  try {
    // Chunk the .in('id', ...) query: a single request with hundreds of photo
    // ids overflows the PostgREST URL length limit and is rejected (HTTP 400).
    const rows = await fetchInChunks(unique, DEFAULT_CHUNK_SIZE, async (chunk) => {
      const { data, error } = await db
        .from('cleaning_photo')
        .select('id, metadata')
        .in('id', chunk);
      if (error) throw error;
      return ((data as unknown[]) ?? []) as Record<string, unknown>[];
    });
    for (const r of rows) {
      if (isSelectedForReport(r.metadata)) selected.add(r.id as string);
      const order = reportOrderFromMetadata(r.metadata);
      if (order != null) reportOrderById.set(r.id as string, order);
    }
  } catch {
    /* table may not exist yet → treat all as unselected */
  }
  return { selectedIds: selected, reportOrderById };
}
async function fetchSelectedPhotoIds(photoIds: string[]): Promise<Set<string>> {
  return (await fetchPhotoReportMeta(photoIds)).selectedIds;
}


/** Resolve the REAL uploader's name per photo id (batched) via the get_cleaning_photo_uploaders RPC. */
async function fetchUploaderByPhotoId(photoIds: string[]): Promise<Map<string, string>> {
  const byId = new Map<string, string>();
  const unique = [...new Set(photoIds.filter(Boolean))];
  if (unique.length === 0) return byId;
  try {
    const rows = await fetchInChunks(unique, DEFAULT_CHUNK_SIZE, async (chunk) => {
      const { data, error } = await db.rpc('get_cleaning_photo_uploaders', { photo_ids: chunk });
      if (error) throw new CleaningServiceError(error.message, error.code);
      return ((data as unknown[]) ?? []) as Record<string, unknown>[];
    });
    for (const r of rows) {
      const id = r.photo_id as string;
      const name = (r.uploader_name as string) ?? '';
      if (id && name) byId.set(id, name);
    }
  } catch {
    // RPC not deployed yet / transient error: the label just shows "—".
  }
  return byId;
}
/** Walk the tree and set `uploadedBy` on every photo found in any `photos` array. */
function applyUploaders(node: unknown, uploaderById: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const n of node) applyUploaders(n, uploaderById);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'photos' && Array.isArray(value)) {
      for (const p of value as { id: string; uploadedBy: string | null }[]) {
        p.uploadedBy = uploaderById.get(p.id) ?? null;
      }
    } else if (value && typeof value === 'object') {
      applyUploaders(value, uploaderById);
    }
  }
}
/** Collect all photo ids present across the zone rows. */
function collectPhotoIds(zoneRows: CleaningZoneRow[]): string[] {
  const ids: string[] = [];
  for (const zone of zoneRows) {
    for (const p of parsePhotosArray(zone.photos)) {
      const id = p.photo_id as string | undefined;
      if (id) ids.push(id);
    }
  }
  return ids;
}

/**
 * Build a leaf zone node for a catalog entry, filling in photos (if any) from
 * the RPC rows keyed by zone_code. Catalog-only (no photos) → empty leaf.
 */
function buildLeafNode(
  code: string,
  rowsByCode: Map<string, CleaningZoneRow>,
  selectedIds: Set<string>,
  reportOrderById?: Map<string, number>,
): CleaningZoneNode {
  const entry = CLEANING_ZONE_BY_CODE[code]!;
  const row = rowsByCode.get(code);
  const zoneId = (row?.cleaning_zone_id as string) ?? null;
  const photos = row
    ? parsePhotosArray(row.photos)
        .map((p) => mapPhoto(p, zoneId, code, selectedIds, reportOrderById))
        .sort((a, b) => a.captureOrder - b.captureOrder)
    : [];
  return {
    zoneId,
    zoneCode: code,
    zoneLabel: (row?.zone_label as string) || entry.labelEs,
    sortOrder: entry.sortOrder,
    isRoot: entry.isRoot,
    isLeaf: entry.isLeaf,
    photos,
    children: [],
  };
}

/**
 * Build the full cleaning tree from the FIXED catalog, merging in any photos the
 * RPC returned (keyed by zone_code). When the RPC returns nothing (not shipped
 * yet / no photos), the tree is the empty catalog skeleton — the exact
 * graceful-degradation analog of repair's catalogStages().
 */
function buildTree(
  zoneRows: CleaningZoneRow[],
  selectedIds: Set<string>,
  reportOrderById?: Map<string, number>,
): CleaningTree {
  const rowsByCode = new Map<string, CleaningZoneRow>();
  for (const row of zoneRows) {
    const code = (row.zone_code as string) ?? '';
    if (code) rowsByCode.set(code, row);
  }

  return CLEANING_ROOT_ZONES.map((root) => {
    if (root.isLeaf) {
      // Hub / Torre: leaf root, photos attach directly.
      return buildLeafNode(root.code, rowsByCode, selectedIds, reportOrderById);
    }
    // Container root (Palas / Nacelle): no own photos, build its sub-zones.
    const children = getCleaningSubZones(root.code).map((sz) =>
      buildLeafNode(sz.code, rowsByCode, selectedIds, reportOrderById),
    );
    return {
      zoneId: null,
      zoneCode: root.code,
      zoneLabel: root.labelEs,
      sortOrder: root.sortOrder,
      isRoot: root.isRoot,
      isLeaf: root.isLeaf,
      photos: [],
      children,
    };
  });
}

/** Flatten a tree into its leaf nodes (where photos live). */
function leafNodes(tree: CleaningTree): CleaningZoneNode[] {
  const leaves: CleaningZoneNode[] = [];
  for (const node of tree) {
    if (node.isLeaf) leaves.push(node);
    for (const child of node.children) {
      if (child.isLeaf) leaves.push(child);
    }
  }
  return leaves;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const cleaningService = {
  /**
   * Get the cleaning campaign header with turbine + wind farm. Same campaign
   * table shape as repair (type='cleaning').
   */
  async getCleaningCampaign(campaignId: string): Promise<CleaningCampaignDetail> {
    const { data, error } = await db
      .from('campaign')
      .select(`
        id, name, status, created_at, updated_at, wind_farm_id, turbine_id,
        wind_farm:wind_farm_id ( id, name, location ),
        turbine:turbine_id ( id, name, model )
      `)
      .eq('id', campaignId)
      .single();

    if (error || !data) {
      throw new CleaningServiceError(error?.message || 'Cleaning campaign not found', error?.code);
    }

    const r = data as Record<string, unknown>;
    const wf = (r.wind_farm as Record<string, unknown>) ?? {};
    const turbine = (r.turbine as Record<string, unknown>) ?? {};

    return {
      id: r.id as string,
      name: r.name as string,
      status: ((r.status as string) ?? 'cleaning_open') as CleaningCampaignStatus,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      windFarmId: r.wind_farm_id as string,
      windFarmName: (wf.name as string) ?? null,
      windFarmLocation: (wf.location as string) ?? null,
      turbineId: (r.turbine_id as string) ?? null,
      turbineName: (turbine.name as string) ?? null,
      turbineModel: (turbine.model as string) ?? null,
    };
  },

  /**
   * Build the full cleaning tree (ROOT zones → sub-zones → photos) via the
   * read-only RPC get_cleaning_photos_by_zone. Photos resolve to PUBLIC urls.
   * Selection state (metadata.selected_for_report) is resolved from
   * cleaning_photo by photo_id. Degrades to the empty catalog skeleton when the
   * mobile RPC/table aren't available yet.
   */
  async getCleaningTree(campaignId: string): Promise<CleaningTree> {
    const zoneRows = await fetchZonesForCampaign(campaignId);
    const photoIds = collectPhotoIds(zoneRows);
    const { selectedIds, reportOrderById } = await fetchPhotoReportMeta(photoIds);
    const tree = buildTree(zoneRows, selectedIds, reportOrderById);
    applyUploaders(tree, await fetchUploaderByPhotoId(photoIds));
    return tree;
  },

  /**
   * Aggregate summary for the cleaning row in the campaigns panel: turbine name,
   * total photos, selected photos, and leaf-zone progress. Degrades to zeros
   * (over the catalog total) when there's no data yet.
   */
  async getCleaningSummary(campaignId: string): Promise<CleaningSummary> {
    const { data: campaign } = await db
      .from('campaign')
      .select('turbine:turbine_id ( name )')
      .eq('id', campaignId)
      .single();
    const turbineName =
      ((campaign?.turbine as Record<string, unknown> | null)?.name as string) ?? null;

    const zoneRows = await fetchZonesForCampaign(campaignId);
    const photoIds = collectPhotoIds(zoneRows);
    const selectedIds = await fetchSelectedPhotoIds(photoIds);
    const tree = buildTree(zoneRows, selectedIds);

    const leaves = leafNodes(tree);
    const totalZones = leaves.length;
    let photosCount = 0;
    let zonesWithPhotos = 0;
    let selectedCount = 0;
    for (const leaf of leaves) {
      if (leaf.photos.length > 0) zonesWithPhotos += 1;
      photosCount += leaf.photos.length;
      selectedCount += leaf.photos.filter((p) => p.cleaningSelected).length;
    }

    return {
      turbineName,
      photosCount,
      selectedCount,
      zonesWithPhotos,
      totalZones,
      zonesProgressPercent:
        totalZones > 0 ? Math.round((zonesWithPhotos / totalZones) * 100) : 0,
      viewedPercent: 0,
    };
  },

  /**
   * Toggle whether a photo is selected for the cleaning report. The RPC is
   * read-only, so selection is persisted by merging
   * metadata.selected_for_report into cleaning_photo.metadata (jsonb), reading
   * the current metadata first so other keys are preserved. Mirrors
   * repairService.setPhotoSelected.
   */
  async setPhotoSelected(photoId: string, selected: boolean): Promise<void> {
    const { data: current, error: readErr } = await db
      .from('cleaning_photo')
      .select('metadata')
      .eq('id', photoId)
      .single();
    if (readErr) throw new CleaningServiceError(readErr.message, readErr.code);

    const metadata = {
      ...(((current?.metadata as Record<string, unknown>) ?? {})),
      selected_for_report: selected,
    };

    const { error } = await db
      .from('cleaning_photo')
      .update({ metadata })
      .eq('id', photoId);
    if (error) throw new CleaningServiceError(error.message, error.code);
  },

  /**
   * Persist the manual order of the photos selected for the report. The array
   * is the desired order (first = first in the report); each photo gets
   * metadata.report_order = its index (metadata is read first and merged so
   * selected_for_report and other keys are preserved). The PDF sorts the
   * selected photos of each zone by this value.
   */
  async setReportOrder(orderedPhotoIds: string[]): Promise<void> {
    const ids = [...new Set(orderedPhotoIds.filter(Boolean))];
    if (ids.length === 0) return;
    const { data: rows, error: readErr } = await db
      .from('cleaning_photo')
      .select('id, metadata')
      .in('id', ids);
    if (readErr) throw new CleaningServiceError(readErr.message, readErr.code);
    const metaById = new Map<string, Record<string, unknown>>(
      ((rows as Array<{ id: string; metadata: unknown }>) ?? []).map((r) => [
        r.id,
        (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>,
      ]),
    );
    const results = await Promise.all(
      ids.map((id, index) =>
        db
          .from('cleaning_photo')
          .update({ metadata: { ...(metaById.get(id) ?? {}), report_order: index } })
          .eq('id', id),
      ),
    );
    const failed = results.find((r: { error: { message: string; code?: string } | null }) => r.error);
    if (failed?.error) throw new CleaningServiceError(failed.error.message, failed.error.code);
  },

  /**
   * Move a photo to a DIFFERENT zone/sub-zone (fixing a photo uploaded under the
   * wrong zone). Only the row's cleaning_zone_id + zone_code are updated so the
   * tree (built by get_cleaning_photos_by_zone, grouped by zone) regroups it
   * under the target zone. The file is NOT moved in storage: urls resolve purely
   * from storage_path, independent of the zone. Mirrors
   * repairService.movePhotoToStage.
   */
  async movePhotoToZone(
    photoId: string,
    targetZoneId: string | null,
    targetZoneCode: string,
  ): Promise<void> {
    const { error } = await db
      .from('cleaning_photo')
      .update({ cleaning_zone_id: targetZoneId, zone_code: targetZoneCode })
      .eq('id', photoId);
    if (error) throw new CleaningServiceError(error.message, error.code);
  },

  /**
   * Upload a photo from the WEB into a cleaning zone/sub-zone. Mirrors
   * repairService.uploadRepairPhoto:
   *   1. Validate the file is an image (jpeg/png).
   *   2. Upload the File to the PUBLIC 'inspection-photos' bucket under
   *      `cleaning/{campaign_id}/{zone_code}/...` (same prefix the mobile app
   *      uses), so publicUrl() resolves it.
   *   3. Insert a cleaning_photo row (campaign_id, cleaning_zone_id, zone_code,
   *      storage_path, filename, capture_order, metadata {}) so the tree picks it
   *      up via get_cleaning_photos_by_zone.
   * The uploader is recorded the same way as repair: storage.objects.owner_id of
   * the uploaded object (set by Supabase from the session). No extra column.
   *
   * capture_order = max existing within the zone (campaign + zone_code) + 1, else 1.
   */
  async uploadCleaningPhoto(
    file: File,
    payload: { campaignId: string; zoneId: string | null; zoneCode: string },
  ): Promise<void> {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      throw new CleaningServiceError(
        `Unsupported file type: ${file.type || 'unknown'}. Only JPEG and PNG are allowed.`,
      );
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `cleaning/${payload.campaignId}/${payload.zoneCode}/${unique}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      throw new CleaningServiceError(`Storage upload failed: ${uploadError.message}`);
    }

    let captureOrder = 1;
    const { data: orderRows } = await db
      .from('cleaning_photo')
      .select('capture_order')
      .eq('campaign_id', payload.campaignId)
      .eq('zone_code', payload.zoneCode)
      .order('capture_order', { ascending: false })
      .limit(1);
    const top = (orderRows as Array<{ capture_order: number | null }> | null)?.[0];
    if (top?.capture_order != null) captureOrder = Number(top.capture_order) + 1;

    // If the DB insert fails, remove the uploaded file so no orphan object stays.
    const { error: insertError } = await db.from('cleaning_photo').insert({
      campaign_id: payload.campaignId,
      cleaning_zone_id: payload.zoneId,
      zone_code: payload.zoneCode,
      storage_path: storagePath,
      filename: file.name,
      capture_order: captureOrder,
      metadata: {},
    });
    if (insertError) {
      await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
      throw new CleaningServiceError(`DB insert failed: ${insertError.message}`, insertError.code);
    }
  },

  /** Update the cleaning campaign workflow status. */
  async updateCleaningStatus(campaignId: string, status: CleaningCampaignStatus): Promise<void> {
    const { error } = await db.from('campaign').update({ status }).eq('id', campaignId);
    if (error) throw new CleaningServiceError(error.message, error.code);
  },
};
