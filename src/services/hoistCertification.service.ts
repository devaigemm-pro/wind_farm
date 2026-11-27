import { supabase } from '@/lib/supabase';
import { fetchInChunks, DEFAULT_CHUNK_SIZE } from '@/utils/chunk';
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
/**
 * Data of the hoist printed in the "detalle de la revisión" of the report
 * (campaign.hoist_details). Label fields are pre-filled by OCR of the hoist
 * label photo and editable on the web.
 */
export interface HoistDetails {
  tag?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  year?: string | null;
  /** Manual override; null/absent = computed from the check results. */
  condition?: 'certificado' | 'certificado_con_observaciones' | null;
  /** When OCR of the label photo last ran (so it doesn't run on every visit). */
  ocrAt?: string | null;
}

/** First hoist label photo (item prep_etiqueta_polipasto) and when it was uploaded. */
export interface HoistLabelPhoto {
  url: string;
  /** Every label photo (OCR tries them all; the first is `url`). */
  urls: string[];
  uploadedAt: string | null;
}

/** Report condition of the hoist: manual override, else "con observaciones" if any check failed. */
export function hoistCondition(
  details: HoistDetails | null | undefined,
  anyFailed: boolean,
): 'certificado' | 'certificado_con_observaciones' {
  if (details?.condition) return details.condition;
  return anyFailed ? 'certificado_con_observaciones' : 'certificado';
}

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
  /** Free text written on the web, printed in the report (campaign.report_comment). */
  reportComment: string | null;
  /** Free text written on the web, printed in the report (campaign.report_recommendation). */
  reportRecommendation: string | null;
  hoistDetails: HoistDetails | null;
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
  /** Manual position in the report (metadata.report_order), set by dragging.
   *  Null = never reordered (falls back to captureOrder). */
  reportOrder: number | null;
  /** Resolved public URL of the full-size photo (for the lightbox). */
  url: string;
  /** Resolved public URL of the thumbnail (for the grid); falls back to url. */
  thumbnailUrl: string;
  /** Real uploader's name (storage owner via get_hoist_photo_uploaders); null when unknown. */
  uploadedBy: string | null;
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

/** Manual position in the report (hoist_cert_photo.metadata.report_order), or null. */
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
/** Map a raw photo object (from the RPC photos[] array) to a HoistPhoto. */
function mapPhoto(
  raw: Record<string, unknown>,
  hoistItemId: string | null,
  itemCode: string,
  selectedIds: Set<string>,
  reportOrderById?: Map<string, number>,
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
    reportOrder: reportOrderById?.get(id) ?? null,
    url,
    thumbnailUrl,
    uploadedBy: null,
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
        .from('hoist_cert_photo')
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


/** Resolve the REAL uploader's name per photo id (batched) via the get_hoist_photo_uploaders RPC. */
async function fetchUploaderByPhotoId(photoIds: string[]): Promise<Map<string, string>> {
  const byId = new Map<string, string>();
  const unique = [...new Set(photoIds.filter(Boolean))];
  if (unique.length === 0) return byId;
  try {
    const rows = await fetchInChunks(unique, DEFAULT_CHUNK_SIZE, async (chunk) => {
      const { data, error } = await db.rpc('get_hoist_photo_uploaders', { photo_ids: chunk });
      if (error) throw new HoistCertificationServiceError(error.message, error.code);
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
  reportOrderById?: Map<string, number>,
): HoistItemNode {
  const entry = HOIST_CERT_BY_CODE[code]!;
  const row = rowsByCode.get(code);
  const itemId = (row?.hoist_item_id as string) ?? null;
  const photos = row
    ? parsePhotosArray(row.photos)
        .map((p) => mapPhoto(p, itemId, code, selectedIds, reportOrderById))
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
function buildTree(
  itemRows: HoistItemRow[],
  selectedIds: Set<string>,
  reportOrderById?: Map<string, number>,
): HoistTree {
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
        // Items hanging directly from the step (shown BEFORE its sub-groups).
        items: getHoistItems(step.code).map((it) =>
          buildItemNode(it.code, rowsByCode, selectedIds, reportOrderById),
        ),
        groups: groups.map((g) => ({
          groupCode: g.code,
          groupLabel: g.labelEs,
          sortOrder: g.sortOrder,
          items: getHoistItems(g.code).map((it) =>
            buildItemNode(it.code, rowsByCode, selectedIds, reportOrderById),
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
        buildItemNode(it.code, rowsByCode, selectedIds, reportOrderById),
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
        report_comment, report_recommendation, hoist_details,
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
      reportComment: (r.report_comment as string) ?? null,
      reportRecommendation: (r.report_recommendation as string) ?? null,
      hoistDetails: (r.hoist_details as HoistDetails) ?? null,
    };
  },

  /**
   * Merge fields into campaign.hoist_details (reads first so other keys are
   * kept). Empty strings are stored as null.
   */
  async setHoistDetails(campaignId: string, patch: Partial<HoistDetails>): Promise<void> {
    const { data, error: readErr } = await db
      .from('campaign')
      .select('hoist_details')
      .eq('id', campaignId)
      .single();
    if (readErr) throw new HoistCertificationServiceError(readErr.message, readErr.code);
    const clean = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, typeof v === 'string' && !v.trim() ? null : v]),
    );
    const next = { ...((data?.hoist_details as HoistDetails) ?? {}), ...clean };
    const { error } = await db.from('campaign').update({ hoist_details: next }).eq('id', campaignId);
    if (error) throw new HoistCertificationServiceError(error.message, error.code);
  },

  /** Hoist label photos (prep_etiqueta_polipasto): first one + all URLs, or null. */
  async getLabelPhoto(campaignId: string): Promise<HoistLabelPhoto | null> {
    const { data, error } = await db
      .from('hoist_cert_photo')
      .select('storage_path, uploaded_at, captured_at, capture_order')
      .eq('campaign_id', campaignId)
      .eq('item_code', 'prep_etiqueta_polipasto')
      .order('capture_order', { ascending: true });
    if (error) return null;
    const rows = ((data as Array<Record<string, unknown>> | null) ?? []).filter((r) => r.storage_path);
    const row = rows[0];
    if (!row) return null;
    return {
      url: publicUrl(row.storage_path as string),
      urls: rows.map((r) => publicUrl(r.storage_path as string)),
      uploadedAt: ((row.uploaded_at ?? row.captured_at) as string) ?? null,
    };
  },

  /** Save the comment or the recommendation of the certification (empty = clear). */
  async setReportText(
    campaignId: string,
    field: 'report_comment' | 'report_recommendation',
    value: string,
  ): Promise<void> {
    const v = value.trim() ? value.trim() : null;
    const { error } = await db.from('campaign').update({ [field]: v }).eq('id', campaignId);
    if (error) throw new HoistCertificationServiceError(error.message, error.code);
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
    const { selectedIds, reportOrderById } = await fetchPhotoReportMeta(photoIds);
    const tree = buildTree(itemRows, selectedIds, reportOrderById);
    applyUploaders(tree, await fetchUploaderByPhotoId(photoIds));
    return tree;
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
      // Only photo-capture items carry photos (verification items show none).
      const shown = item.itemType === 'photo' ? item.photos : [];
      photosCount += shown.length;
      selectedCount += shown.filter((p) => p.hoistSelected).length;
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
   * Persist the manual order of the photos selected for the report. The array
   * is the desired order (first = first in the report); each photo gets
   * metadata.report_order = its index (metadata is read first and merged so
   * selected_for_report and other keys are preserved). The PDF sorts the
   * selected photos of each item by this value.
   */
  async setReportOrder(orderedPhotoIds: string[]): Promise<void> {
    const ids = [...new Set(orderedPhotoIds.filter(Boolean))];
    if (ids.length === 0) return;
    const { data: rows, error: readErr } = await db
      .from('hoist_cert_photo')
      .select('id, metadata')
      .in('id', ids);
    if (readErr) throw new HoistCertificationServiceError(readErr.message, readErr.code);
    const metaById = new Map<string, Record<string, unknown>>(
      ((rows as Array<{ id: string; metadata: unknown }>) ?? []).map((r) => [
        r.id,
        (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>,
      ]),
    );
    const results = await Promise.all(
      ids.map((id, index) =>
        db
          .from('hoist_cert_photo')
          .update({ metadata: { ...(metaById.get(id) ?? {}), report_order: index } })
          .eq('id', id),
      ),
    );
    const failed = results.find((r: { error: { message: string; code?: string } | null }) => r.error);
    if (failed?.error) {
      throw new HoistCertificationServiceError(failed.error.message, failed.error.code);
    }
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

  /**
   * Upload a photo from the WEB into a hoist-certification item. Mirrors
   * repairService.uploadRepairPhoto / cleaningService.uploadCleaningPhoto:
   *   1. Validate the file is an image (jpeg/png).
   *   2. Upload to the PUBLIC 'inspection-photos' bucket under
   *      `hoist/{campaign_id}/{item_code}/...` (same prefix the mobile app uses).
   *   3. Insert a hoist_cert_photo row (campaign_id, hoist_item_id, item_code,
   *      storage_path, filename, capture_order, metadata {}).
   * The uploader is recorded like repair: storage.objects.owner_id. No extra column.
   *
   * capture_order = max existing within the item (campaign + item_code) + 1, else 1.
   */
  async uploadHoistPhoto(
    file: File,
    payload: { campaignId: string; itemId: string | null; itemCode: string },
  ): Promise<void> {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      throw new HoistCertificationServiceError(
        `Unsupported file type: ${file.type || 'unknown'}. Only JPEG and PNG are allowed.`,
      );
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `hoist/${payload.campaignId}/${payload.itemCode}/${unique}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      throw new HoistCertificationServiceError(`Storage upload failed: ${uploadError.message}`);
    }

    let captureOrder = 1;
    const { data: orderRows } = await db
      .from('hoist_cert_photo')
      .select('capture_order')
      .eq('campaign_id', payload.campaignId)
      .eq('item_code', payload.itemCode)
      .order('capture_order', { ascending: false })
      .limit(1);
    const top = (orderRows as Array<{ capture_order: number | null }> | null)?.[0];
    if (top?.capture_order != null) captureOrder = Number(top.capture_order) + 1;

    // If the DB insert fails, remove the uploaded file so no orphan object stays.
    const { error: insertError } = await db.from('hoist_cert_photo').insert({
      campaign_id: payload.campaignId,
      hoist_item_id: payload.itemId,
      item_code: payload.itemCode,
      storage_path: storagePath,
      filename: file.name,
      capture_order: captureOrder,
      metadata: {},
    });
    if (insertError) {
      await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
      throw new HoistCertificationServiceError(
        `DB insert failed: ${insertError.message}`,
        insertError.code,
      );
    }
  },

  /** Update the hoist-certification campaign workflow status. */
  /**
   * Set (or clear) the value of a web-editable item from the web, before the
   * report is generated. Upserts the hoist_cert_item row keyed by
   * (campaign_id, item_code), so it works whether or not the mobile app already
   * sent it; an empty value clears it. RLS allows technician/inspector/admin/
   * supervisor to write.
   */
  async setItemValue(campaignId: string, itemCode: string, value: string | null): Promise<void> {
    const v = value?.trim() ? value.trim() : null;
    const { error } = await db
      .from('hoist_cert_item')
      .upsert(
        { campaign_id: campaignId, item_code: itemCode, item_type: 'measurement', measurement_value: v },
        { onConflict: 'campaign_id,item_code' },
      );
    if (error) throw new HoistCertificationServiceError(error.message, error.code);
  },

  async updateHoistStatus(
    campaignId: string,
    status: HoistCertificationStatus,
  ): Promise<void> {
    const { error } = await db.from('campaign').update({ status }).eq('id', campaignId);
    if (error) throw new HoistCertificationServiceError(error.message, error.code);
  },
};
