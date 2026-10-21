import { supabase } from '@/lib/supabase';
import {
  HOIST_CERT_STEPS,
  HOIST_CERT_BY_CODE,
  getHoistGroups,
  getHoistItems,
  type HoistItemType,
} from '@/constants/hoist-certification-steps';
import type { HoistCertificationStatus } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Hoist certification ("Certificación de polipastos") web-side service.
 *
 * MIRRORS cleaning.service.ts, but for HOIST-CERTIFICATION campaigns. The
 * structure is a hierarchy of fixed STEPS (pasos) → optional SUB-GROUPS (grupos)
 * → TYPED ITEMS, instead of cleaning's zones → sub-zones → photos. The KEY
 * modeling difference vs cleaning is that leaves are not just photos: each item
 * has an `itemType` and carries the state captured by the mobile app:
 *
 *   • 'photo'        → photos[] only (identical to a cleaning zone).
 *   • 'check'        → a boolean passed (cumple/no cumple); may also have photos.
 *   • 'measurement'  → a numeric/text measurementValue + photos[].
 *
 * ─── DATA CONTRACT (written by the TECHNICIAN MOBILE APP, read-only here) ────
 *
 * The web app NEVER writes hoist-certification items; the mobile team owns these
 * objects and will create them. The contract mirrors cleaning, extended to carry
 * the typed item state (passed / measurement_value):
 *
 *   • RPC  get_hoist_cert_items(campaign_id_param uuid)
 *       Read-only. Returns ONE ROW PER ITEM that has data, shaped like
 *       get_cleaning_photos_by_zone but keyed by the item instead of the zone:
 *         {
 *           hoist_item_id   uuid,       -- row id of the item instance
 *           item_code       text,       -- matches hoist-certification-steps.ts `code`
 *           item_type       text,       -- 'photo' | 'check' | 'measurement'
 *           item_label      text|null,  -- optional display label
 *           item_order      int|null,
 *           passed          boolean|null,     -- for 'check' (and optionally 'measurement')
 *           measurement_value text|null,      -- for 'measurement' (numeric sent as text/number)
 *           measurement_unit  text|null,      -- optional unit (e.g. 'mm', '%')
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
 *   • TABLE hoist_cert_item   (one row per captured item of a campaign)
 *       id                uuid pk
 *       campaign_id       uuid  -> campaign.id (type='hoist_certification')
 *       item_code         text  -- matches hoist-certification-steps.ts `code`
 *       item_type         text  -- 'photo' | 'check' | 'measurement'
 *       passed            boolean|null   -- cumple/no cumple for 'check'
 *       measurement_value text|null      -- value for 'measurement'
 *       measurement_unit  text|null
 *       metadata          jsonb          -- reserved for future use
 *
 *   • TABLE hoist_cert_photo  (one row per photo, FK to the item it belongs to)
 *       id               uuid pk
 *       campaign_id      uuid  -> campaign.id
 *       hoist_item_id    uuid|null -> hoist_cert_item.id
 *       item_code        text  -- matches hoist-certification-steps.ts `code`
 *       storage_path     text
 *       thumbnail_path   text|null
 *       filename         text
 *       capture_order    int
 *       captured_at      timestamptz|null
 *       metadata         jsonb -- { selected_for_report: boolean }
 *
 *   • STORAGE  PUBLIC bucket 'inspection-photos'
 *       Native hoist-certification photos live under:
 *         hoist/{campaign_id}/{item_code}/{filename}
 *       so storage_path resolves to a PUBLIC url (same as cleaning/...).
 *
 * GRACEFUL DEGRADATION: if the RPC/tables don't exist yet (the mobile team
 * hasn't shipped them), every read falls back to the EMPTY item catalog so the
 * UI still renders the step/group/item skeleton — exactly like cleaning's empty
 * zone catalog. Any error from the RPC or the metadata query is caught and
 * swallowed.
 */
export class HoistCertificationServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'HoistCertificationServiceError';
  }
}

const PHOTO_BUCKET = 'inspection-photos';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Aggregated hoist-certification campaign header (campaign + turbine + wind farm). */
export interface HoistCampaignDetail {
  id: string;
  name: string;
  status: HoistCertificationStatus;
  createdAt: string;
  updatedAt: string;
  windFarmId: string;
  windFarmName: string | null;
  windFarmLocation: string | null;
  turbineId: string | null;
  turbineName: string | null;
  turbineModel: string | null;
}

/** A hoist-certification photo (from get_hoist_cert_items → photos[]). */
export interface HoistPhoto {
  id: string;
  /** Row id of the item instance this photo belongs to (null for catalog fallback). */
  hoistItemId: string | null;
  /** Item code (matches hoist-certification-steps.ts). */
  itemCode: string;
  storagePath: string;
  thumbnailPath: string | null;
  filename: string;
  captureOrder: number;
  capturedAt: string | null;
  /** metadata.selected_for_report. */
  hoistSelected: boolean;
  /** Resolved public URL of the full-size photo (for the lightbox). */
  url: string;
  /** Resolved public URL of the thumbnail (for the grid); falls back to url. */
  thumbnailUrl: string;
}

/**
 * One typed ITEM leaf of the hoist-certification tree. The `itemType` drives how
 * the web renders it:
 *   - 'photo'        → photos[] gallery with selection for the report.
 *   - 'check'        → pass/fail indicator from `passed` (+ optional photos).
 *   - 'measurement'  → `measurementValue` (+ unit) and photos[] with selection.
 */
export interface HoistItemNode {
  /** hoist_item_id from the RPC, null for the catalog fallback. */
  itemId: string | null;
  itemCode: string;
  itemLabel: string;
  itemType: HoistItemType;
  sortOrder: number;
  /** For 'check' (and optionally 'measurement'): cumple (true) / no cumple (false) / sin dato (null). */
  passed: boolean | null;
  /** For 'measurement': the captured value (numeric or text). Null = sin dato. */
  measurementValue: number | string | null;
  /** Optional measurement unit (e.g. 'mm', '%'). */
  measurementUnit: string | null;
  photos: HoistPhoto[];
}

/**
 * One SUB-GROUP of a step (e.g. "Cadena de carga"). Holds typed items. Only
 * steps that have groups populate this; a step without groups holds its items
 * directly in HoistStepNode.items.
 */
export interface HoistGroupNode {
  groupCode: string;
  groupLabel: string;
  sortOrder: number;
  items: HoistItemNode[];
}

/**
 * One STEP (paso) node of the tree. A step either holds items DIRECTLY (`items`,
 * `groups` empty) or groups them under `groups` (`items` empty).
 */
export interface HoistStepNode {
  stepCode: string;
  stepLabel: string;
  sortOrder: number;
  /** True when this step uses sub-groups (groups populated, items empty). */
  hasGroups: boolean;
  items: HoistItemNode[];
  groups: HoistGroupNode[];
}

/** Full hoist-certification tree: ordered STEPS → (groups) → typed items. */
export type HoistTree = HoistStepNode[];

/** Summary data for the hoist-certification row in the campaigns panel. */
export interface HoistSummary {
  turbineName: string | null;
  photosCount: number;
  selectedCount: number;
  /** Number of items that carry data (photos, a check result, or a measurement). */
  itemsWithData: number;
  /** Total items (from the catalog). */
  totalItems: number;
  /** % of items that carry data (0-100). */
  itemsProgressPercent: number;
  /** Number of 'check' items that passed (cumple). */
  checksPassed: number;
  /** Number of 'check' items captured (passed !== null). */
  checksEvaluated: number;
  /** Kept for panel-column parity with cleaning/repair; always 0 here. */
  viewedPercent: number;
}

// ─── RPC row shapes ───────────────────────────────────────────────────────────

interface HoistItemRow {
  hoist_item_id?: string | null;
  item_code?: string | null;
  item_type?: string | null;
  item_label?: string | null;
  item_order?: number | null;
  passed?: boolean | null;
  measurement_value?: number | string | null;
  measurement_unit?: string | null;
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

/** Whether a hoist_cert_photo.metadata marks the photo as selected for the report. */
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

/** Parse the photos[] value from an item row into an array of raw photo objects. */
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

/** Map a raw photo object (from the RPC photos[] array) to a HoistPhoto. */
function mapPhoto(
  raw: Record<string, unknown>,
  hoistItemId: string | null,
  itemCode: string,
  selectedIds: Set<string>,
): HoistPhoto {
  const id = (raw.photo_id as string) ?? '';
  const storagePath = (raw.storage_path as string) ?? '';
  const thumbnailPath = (raw.thumbnail_path as string) ?? null;
  const url = publicUrl(storagePath);
  const thumbnailUrl = thumbnailPath ? publicUrl(thumbnailPath) : url;
  return {
    id,
    hoistItemId,
    itemCode,
    storagePath,
    thumbnailPath,
    filename: (raw.filename as string) ?? '',
    captureOrder: Number(raw.capture_order) || 0,
    capturedAt: (raw.captured_at as string) ?? null,
    hoistSelected: selectedIds.has(id),
    url,
    thumbnailUrl,
  };
}

/**
 * Call get_hoist_cert_items for a campaign and return its item rows. Degrades
 * gracefully to [] when the RPC doesn't exist yet or errors.
 */
async function fetchItemsForCampaign(campaignId: string): Promise<HoistItemRow[]> {
  try {
    const { data, error } = await db.rpc('get_hoist_cert_items', {
      campaign_id_param: campaignId,
    });
    if (error) return [];
    return ((data as unknown[]) ?? []) as HoistItemRow[];
  } catch {
    return [];
  }
}

/**
 * Read hoist_cert_photo.metadata for a set of photo ids and return the set that
 * is selected_for_report. Degrades gracefully to an empty set when the table
 * doesn't exist yet or errors.
 */
async function fetchSelectedPhotoIds(photoIds: string[]): Promise<Set<string>> {
  const selected = new Set<string>();
  const unique = [...new Set(photoIds.filter(Boolean))];
  if (unique.length === 0) return selected;
  try {
    const { data, error } = await db
      .from('hoist_cert_photo')
      .select('id, metadata')
      .in('id', unique);
    if (error) return selected;
    for (const row of (data as unknown[]) ?? []) {
      const r = row as Record<string, unknown>;
      if (isSelectedForReport(r.metadata)) selected.add(r.id as string);
    }
  } catch {
    /* table may not exist yet → treat all as unselected */
  }
  return selected;
}

/** Collect all photo ids present across the item rows. */
function collectPhotoIds(itemRows: HoistItemRow[]): string[] {
  const ids: string[] = [];
  for (const item of itemRows) {
    for (const p of parsePhotosArray(item.photos)) {
      const id = p.photo_id as string | undefined;
      if (id) ids.push(id);
    }
  }
  return ids;
}

/** Normalize the raw `passed` value (boolean | null | string) to boolean|null. */
function normalizePassed(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

/** Normalize the raw measurement value to number|string|null. */
function normalizeMeasurement(value: unknown): number | string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : String(value);
}

/**
 * Build a typed item node for a catalog item entry, filling in state (photos,
 * passed, measurement) from the RPC rows keyed by item_code. Catalog-only (no
 * data) → empty item.
 */
function buildItemNode(
  code: string,
  rowsByCode: Map<string, HoistItemRow>,
  selectedIds: Set<string>,
): HoistItemNode {
  const entry = HOIST_CERT_BY_CODE[code]!;
  const row = rowsByCode.get(code);
  const itemId = (row?.hoist_item_id as string) ?? null;
  const photos = row
    ? parsePhotosArray(row.photos)
        .map((p) => mapPhoto(p, itemId, code, selectedIds))
        .sort((a, b) => a.captureOrder - b.captureOrder)
    : [];
  return {
    itemId,
    itemCode: code,
    itemLabel: (row?.item_label as string) || entry.labelEs,
    // Catalog item type is authoritative; RPC item_type is advisory only.
    itemType: entry.itemType ?? 'photo',
    sortOrder: entry.sortOrder,
    passed: normalizePassed(row?.passed),
    measurementValue: normalizeMeasurement(row?.measurement_value),
    measurementUnit: (row?.measurement_unit as string) ?? null,
    photos,
  };
}

/**
 * Build the full hoist-certification tree from the FIXED catalog, merging in any
 * data the RPC returned (keyed by item_code). When the RPC returns nothing (not
 * shipped yet / no data), the tree is the empty catalog skeleton — the exact
 * graceful-degradation analog of cleaning's empty zone catalog.
 */
function buildTree(itemRows: HoistItemRow[], selectedIds: Set<string>): HoistTree {
  const rowsByCode = new Map<string, HoistItemRow>();
  for (const row of itemRows) {
    const code = (row.item_code as string) ?? '';
    if (code) rowsByCode.set(code, row);
  }

  return HOIST_CERT_STEPS.map((step) => {
    const groups = getHoistGroups(step.code);
    if (groups.length > 0) {
      // Step with sub-groups: build each group's items.
      return {
        stepCode: step.code,
        stepLabel: step.labelEs,
        sortOrder: step.sortOrder,
        hasGroups: true,
        items: [],
        groups: groups.map((g) => ({
          groupCode: g.code,
          groupLabel: g.labelEs,
          sortOrder: g.sortOrder,
          items: getHoistItems(g.code).map((it) =>
            buildItemNode(it.code, rowsByCode, selectedIds),
          ),
        })),
      };
    }
    // Step with items directly.
    return {
      stepCode: step.code,
      stepLabel: step.labelEs,
      sortOrder: step.sortOrder,
      hasGroups: false,
      items: getHoistItems(step.code).map((it) =>
        buildItemNode(it.code, rowsByCode, selectedIds),
      ),
      groups: [],
    };
  });
}

/** Flatten a tree into all its typed item nodes (where photos/state live). */
function allItems(tree: HoistTree): HoistItemNode[] {
  const items: HoistItemNode[] = [];
  for (const step of tree) {
    for (const it of step.items) items.push(it);
    for (const g of step.groups) {
      for (const it of g.items) items.push(it);
    }
  }
  return items;
}

/** Whether an item carries any captured data (photos, a check result, or a measurement). */
function itemHasData(item: HoistItemNode): boolean {
  if (item.photos.length > 0) return true;
  if (item.itemType === 'check' && item.passed !== null) return true;
  if (item.itemType === 'measurement' && item.measurementValue !== null) return true;
  return false;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const hoistCertificationService = {
  /**
   * Get the hoist-certification campaign header with turbine + wind farm. Same
   * campaign table shape as cleaning (type='hoist_certification').
   */
  async getHoistCampaign(campaignId: string): Promise<HoistCampaignDetail> {
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
      throw new HoistCertificationServiceError(
        error?.message || 'Hoist certification campaign not found',
        error?.code,
      );
    }

    const r = data as Record<string, unknown>;
    const wf = (r.wind_farm as Record<string, unknown>) ?? {};
    const turbine = (r.turbine as Record<string, unknown>) ?? {};

    return {
      id: r.id as string,
      name: r.name as string,
      status: ((r.status as string) ?? 'hoist_open') as HoistCertificationStatus,
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
   * Build the full hoist-certification tree (STEPS → groups → typed items) via
   * the read-only RPC get_hoist_cert_items. Photos resolve to PUBLIC urls.
   * Selection state (metadata.selected_for_report) is resolved from
   * hoist_cert_photo by photo_id. Degrades to the empty catalog skeleton when
   * the mobile RPC/tables aren't available yet.
   */
  async getHoistTree(campaignId: string): Promise<HoistTree> {
    const itemRows = await fetchItemsForCampaign(campaignId);
    const photoIds = collectPhotoIds(itemRows);
    const selectedIds = await fetchSelectedPhotoIds(photoIds);
    return buildTree(itemRows, selectedIds);
  },

  /**
   * Aggregate summary for the hoist-certification row in the campaigns panel:
   * turbine name, total photos, selected photos, item progress and check tally.
   * Degrades to zeros (over the catalog total) when there's no data yet.
   */
  async getHoistSummary(campaignId: string): Promise<HoistSummary> {
    const { data: campaign } = await db
      .from('campaign')
      .select('turbine:turbine_id ( name )')
      .eq('id', campaignId)
      .single();
    const turbineName =
      ((campaign?.turbine as Record<string, unknown> | null)?.name as string) ?? null;

    const itemRows = await fetchItemsForCampaign(campaignId);
    const photoIds = collectPhotoIds(itemRows);
    const selectedIds = await fetchSelectedPhotoIds(photoIds);
    const tree = buildTree(itemRows, selectedIds);

    const items = allItems(tree);
    const totalItems = items.length;
    let photosCount = 0;
    let selectedCount = 0;
    let itemsWithData = 0;
    let checksPassed = 0;
    let checksEvaluated = 0;
    for (const item of items) {
      photosCount += item.photos.length;
      selectedCount += item.photos.filter((p) => p.hoistSelected).length;
      if (itemHasData(item)) itemsWithData += 1;
      if (item.itemType === 'check' && item.passed !== null) {
        checksEvaluated += 1;
        if (item.passed) checksPassed += 1;
      }
    }

    return {
      turbineName,
      photosCount,
      selectedCount,
      itemsWithData,
      totalItems,
      itemsProgressPercent:
        totalItems > 0 ? Math.round((itemsWithData / totalItems) * 100) : 0,
      checksPassed,
      checksEvaluated,
      viewedPercent: 0,
    };
  },

  /**
   * Toggle whether a photo is selected for the hoist-certification report. The
   * RPC is read-only, so selection is persisted by merging
   * metadata.selected_for_report into hoist_cert_photo.metadata (jsonb), reading
   * the current metadata first so other keys are preserved. Mirrors
   * cleaningService.setPhotoSelected.
   */
  async setPhotoSelected(photoId: string, selected: boolean): Promise<void> {
    const { data: current, error: readErr } = await db
      .from('hoist_cert_photo')
      .select('metadata')
      .eq('id', photoId)
      .single();
    if (readErr) throw new HoistCertificationServiceError(readErr.message, readErr.code);

    const metadata = {
      ...(((current?.metadata as Record<string, unknown>) ?? {})),
      selected_for_report: selected,
    };

    const { error } = await db
      .from('hoist_cert_photo')
      .update({ metadata })
      .eq('id', photoId);
    if (error) throw new HoistCertificationServiceError(error.message, error.code);
  },

  /**
   * Move a photo to a DIFFERENT item (fixing a photo uploaded under the wrong
   * item). Only the row's hoist_item_id + item_code are updated so the tree
   * (built by get_hoist_cert_items, grouped by item) regroups it under the
   * target item. The file is NOT moved in storage: urls resolve purely from
   * storage_path, independent of the item. Mirrors cleaningService.movePhotoToZone.
   * Only meaningful for items that hold photos ('photo' and 'measurement').
   */
  async movePhotoBetweenItems(
    photoId: string,
    targetItemId: string | null,
    targetItemCode: string,
  ): Promise<void> {
    const { error } = await db
      .from('hoist_cert_photo')
      .update({ hoist_item_id: targetItemId, item_code: targetItemCode })
      .eq('id', photoId);
    if (error) throw new HoistCertificationServiceError(error.message, error.code);
  },

  /** Update the hoist-certification campaign workflow status. */
  async updateHoistStatus(
    campaignId: string,
    status: HoistCertificationStatus,
  ): Promise<void> {
    const { error } = await db.from('campaign').update({ status }).eq('id', campaignId);
    if (error) throw new HoistCertificationServiceError(error.message, error.code);
  },
};
