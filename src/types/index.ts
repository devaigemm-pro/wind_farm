/**
 * Application-level types, enums, and constants for Wind Blade Inspection.
 */

import type { Tables } from './supabase';

// ─── Shared Type Aliases (union types matching DB constraints) ───────────────

export type UserRole = 'inspector' | 'supervisor' | 'admin' | 'client';

export type InspectionStatus = 'in_progress' | 'completed' | 'approved';

export type InspectionStage = 'planned' | 'inspect' | 'annotate' | 'analyze' | 'report';

export type DefectType =
  | 'le_erosion'
  | 'vortex'
  | 'paint_defect'
  | 'crack'
  | 'delamination'
  | 'lightning_damage'
  | 'other';

export type Severity = 1 | 2 | 3 | 4 | 5;

export type ReportType = 'inspection' | 'consolidated';

export type MimeType = 'image/jpeg' | 'image/png';

// ─── Constants ──────────────────────────────────────────────────────────────

export const USER_ROLES: readonly UserRole[] = ['inspector', 'supervisor', 'admin', 'client'] as const;

export const INSPECTION_STATUSES: readonly InspectionStatus[] = [
  'in_progress',
  'completed',
  'approved',
] as const;

export const INSPECTION_STAGES: readonly InspectionStage[] = [
  'planned',
  'inspect',
  'annotate',
  'analyze',
  'report',
] as const;

export const DEFECT_TYPES: readonly DefectType[] = [
  'le_erosion',
  'vortex',
  'paint_defect',
  'crack',
  'delamination',
  'lightning_damage',
  'other',
] as const;

export const SEVERITIES: readonly Severity[] = [1, 2, 3, 4, 5] as const;

export const MAX_FILE_SIZE_BYTES = 20_971_520; // 20 MB

export const ALLOWED_MIME_TYPES: readonly MimeType[] = ['image/jpeg', 'image/png'] as const;

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─── Application-Level Interfaces ───────────────────────────────────────────

/** Profile (user) with typed role */
export interface Profile extends Omit<Tables<'profiles'>, 'role'> {
  role: UserRole;
}

/** Wind farm with optional nested turbines */
export interface WindFarm extends Tables<'wind_farm'> {
  turbines?: Turbine[];
}

/** Turbine with optional nested blades */
export interface Turbine extends Tables<'turbine'> {
  blades?: Blade[];
  wind_farm?: WindFarm;
}

/** Blade with optional nested inspections */
export interface Blade extends Tables<'blade'> {
  turbine?: Turbine;
  inspections?: Inspection[];
}

/** Inspection with typed status/stage and optional relations */
export interface Inspection extends Omit<Tables<'inspection'>, 'status' | 'stage'> {
  status: InspectionStatus;
  stage: InspectionStage;
  turbine_id?: string | null;
  blade?: Blade;
  turbine?: Turbine;
  inspector?: Profile;
  approved_by_profile?: Profile;
  evidence?: Evidence[];
  defects?: Defect[];
}

/** Evidence file record */
export interface Evidence extends Omit<Tables<'evidence'>, 'mime_type'> {
  mime_type: MimeType;
}

/** Defect with typed type and severity */
export interface Defect extends Omit<Tables<'defect'>, 'type' | 'severity'> {
  type: DefectType;
  severity: Severity;
  images?: Evidence[];
}

/** Report record with typed report type */
export interface Report extends Omit<Tables<'report'>, 'type'> {
  type: ReportType | 'pdf' | 'xlsx';
}

// ─── Reports Page Types ─────────────────────────────────────────────────────

/** Row data for the reports list (finalized inspections) */
export interface InspectionReportRow {
  id: string;
  inspectionDate: string;
  asset: string;
  assetId: string;
  subAsset: string;
  subAssetId: string;
  type: string;
  defectsCount: number;
  note: string | null;
  pdfStoragePath: string | null;
}

/** Sort fields for reports table */
export type ReportSortField =
  | 'inspectionDate'
  | 'asset'
  | 'subAsset'
  | 'type'
  | 'defectsCount'
  | 'note'
  | 'pdfReport';

// ─── Wind Farm Dashboard Types ──────────────────────────────────────────────

/** Aggregated data for a wind farm in the dashboard table */
export interface WindFarmDashboardRow {
  id: string;
  name: string;
  subAssetsCount: number;
  inspectionsCount: number;
  totalPower: number;
  poweringDate: string | null;
  oldestInspection: string | null;
}

// ─── Defects Dashboard Types ────────────────────────────────────────────────

/** Sort fields for the defects dashboard table */
export type DefectSortField =
  | 'assetName'
  | 'turbineName'
  | 'turbineModel'
  | 'type'
  | 'defectSize'
  | 'category'
  | 'action'
  | 'nextStep'
  | 'blade'
  | 'side'
  | 'rootDistance'
  | 'resolved';

/** Row data for the defects dashboard table */
export interface DefectDashboardRow {
  id: string;
  assetName: string;
  turbineName: string;
  turbineModel: string;
  type: string;
  defectWidth: number;
  defectHeight: number;
  category: number;
  actionText: string;
  actionUrgency: 'high' | 'medium' | 'low';
  nextStep: string;
  bladePosition: string;
  side: string;
  rootDistance: number;
  rootCause: string | null;
  notes: string | null;
  imageUrl: string | null;
  resolved: boolean;
  inspectionId: string;
  bladeId: string;
  annotX?: number;
  annotY?: number;
  annotW?: number;
  annotH?: number;
  annotAngle?: number;
}

/** Comment on a defect */
export interface DefectComment {
  id: string;
  defectId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

/** Blade position labels mapping (1-indexed) */
export const BLADE_POSITION_LABELS: Record<number, string> = {
  1: 'A',
  2: 'B',
  3: 'C',
};

/** Display labels for defect types in the dashboard */
export const DEFECT_TYPE_DISPLAY_LABELS: Record<string, string> = {
  le_erosion: 'LE EROSION',
  vortex: 'VORTEX (MISSING PANELS)',
  paint_defect: 'PAINT DAMAGES',
  crack: 'CRACK',
  delamination: 'DELAMINATION',
  lightning_damage: 'LIGHTNING DAMAGE',
  other: 'OTHER ADD-ONS MISSING',
};

// ─── Asset Tree Types ───────────────────────────────────────────────────────

export interface AssetTreeNode {
  id: string;
  name: string;
  type: 'wind_farm' | 'turbine' | 'blade';
  children?: AssetTreeNode[];
}

// ─── Asset Detail Types ─────────────────────────────────────────────────────

/** Aggregated wind farm detail data */
export interface WindFarmDetail {
  id: string;
  name: string;
  location: string;
  poweringDate: string | null;
  totalPower: number;
  subAssetsCount: number;
  oldestInspection: string | null;
  inspectionsCount: number;
}

/** Turbine row in the subassets table */
export interface TurbineSubassetRow {
  id: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  powerKw: number;
  poweringDate: string | null;
  lastInspection: string | null;
  inspectionsCount: number;
}

/** Campaign discriminator: inspection (drone photos) vs repair (from approved quote) */
export type CampaignType = 'inspection' | 'repair';

/** Repair campaign workflow status */
export type RepairCampaignStatus = 'repair_open' | 'repair_in_progress' | 'repair_done';

/** Campaign entity */
export interface Campaign {
  id: string;
  name: string;
  windFarmId: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  type?: CampaignType;
  turbineId?: string | null;
  quoteId?: string | null;
  status?: string | null;
}

/** Repair campaign created when a quote is approved */
export interface RepairCampaign {
  id: string;
  name: string;
  windFarmId: string;
  turbineId: string | null;
  quoteId: string | null;
  status: RepairCampaignStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Inspection within a campaign (for the campaign table) */
export interface CampaignInspection {
  id: string;
  inspectionDate: string;
  subassetName: string;
  status: InspectionStatus;
  stage: string;
  inspectionType: string;
  photosCount: number;
  viewedPercent: number;
  defectsCount: number;
  notes: string | null;
  reportUrl: string | null;
  reportStoragePath: string | null;
  campaignId: string | null;
  turbineId?: string | null;
}

/** Asset document record */
export interface AssetDocument {
  id: string;
  windFarmId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

/** Serial numbers for a turbine (used in modal) */
export interface TurbineSerialNumbers {
  turbineId: string;
  turbineName: string;
  turbineSerial: string;
  bladeASerial: string;
  bladeBSerial: string;
  bladeCSerial: string;
  towerSerial: string;
  anticlockwise: boolean;
}

// ─── New Inspection Types (RF-002) ──────────────────────────────────────────

/** Type of inspection */
export type InspectionType = 'blades' | 'tower';

/** Method of inspection */
export type InspectionMethod = 'skyvisor' | 'external';

/** Turbine row for the subassets selection table in new inspection form */
export interface SubassetSelectionRow {
  id: string;
  name: string;
  model: string | null;
  lastInspectionDate: string | null;
  lastDefectsCount: number;
  selected: boolean;
}

/** Input for creating a campaign with multiple inspections */
export interface CreateCampaignInspectionInput {
  windFarmId: string;
  campaignName: string;
  inspectionType: InspectionType;
  inspectionMethod: InspectionMethod;
  scheduledDate: string;
  notes: string;
  selectedTurbineIds: string[];
}

/** Geographic coordinates of a wind farm (for Windy iframe) */
export interface WindFarmCoordinates {
  latitude: number;
  longitude: number;
}

// ─── Campaign Results Types ─────────────────────────────────────────────────

/** Campaign results summary per turbine */
export interface CampaignTurbineResult {
  turbineId: string;
  turbineName: string;
  defectsByCat: Record<number, number>; // cat 1-5 → count
  resolvedCount: number;
  totalDefects: number;
  blades: {
    position: string;
    defectsByCat: Record<number, number>;
    resolvedCount: number;
    totalDefects: number;
  }[];
}

// ─── Drone Inspection Photo Types ───────────────────────────────────────────

/** Blade face identifiers for 360° inspection view */
export type BladeFace = 'leading_edge' | 'trailing_edge' | 'suction_side' | 'pressure_side';

/** Campaign workflow status */
export type CampaignStatus = 'awaiting_photos' | 'photos_uploaded' | 'annotating' | 'completed';

/** Display labels for blade faces */
export const BLADE_FACE_LABELS: Record<BladeFace, string> = {
  leading_edge: 'Leading Edge',
  trailing_edge: 'Trailing Edge',
  suction_side: 'Suction Side',
  pressure_side: 'Pressure Side',
};

/** Short labels for blade faces */
export const BLADE_FACE_SHORT: Record<BladeFace, string> = {
  leading_edge: 'LE',
  trailing_edge: 'TE',
  suction_side: 'SS',
  pressure_side: 'PS',
};

/** Inspection photo captured by drone */
export interface InspectionPhoto {
  id: string;
  campaignId: string;
  inspectionId: string | null;
  bladeId: string;
  face: BladeFace;
  radialPosition: number; // 0 = root, 1 = tip
  flightPlanOrder: number;
  storagePath: string;
  filename: string;
  thumbnailPath: string | null;
  widthPx: number | null;
  heightPx: number | null;
  capturedAt: string | null;
  uploadedAt: string;
  analyzed: boolean;
  metadata: Record<string, unknown>;
}

/** Payload sent by the drone agent when uploading photos */
export interface DroneUploadPayload {
  campaignId: string;
  bladeId: string;
  face: BladeFace;
  radialPosition: number;
  flightPlanOrder: number;
  filename: string;
  capturedAt?: string;
  metadata?: Record<string, unknown>;
}

/** Upload progress per blade face */
export interface BladeUploadProgress {
  bladeId: string;
  bladePosition: number;
  face: BladeFace;
  photoCount: number;
  analyzedCount: number;
}

/** Campaign with status for drone workflow */
export interface CampaignWithStatus extends Campaign {
  status: CampaignStatus;
}

/** One photo-sync record (one campaign that has at least one uploaded photo) */
export interface UploadRecord {
  campaignId: string;
  campaignName: string;
  windFarmId: string | null;
  windFarmName: string | null;
  turbineNames: string[];
  photoCount: number;
  uploadedBy: string | null;
  uploadedAt: string | null;
  status: CampaignStatus;
}

/** Defect data for the results/export view */
export interface ResultsDefect {
  id: string;
  displayId: string;
  type: string;
  severity: number;
  blade: string;
  side: string;
  distanceFromRoot: number;
  widthCm: number | null;
  heightCm: number | null;
  description: string | null;
  resolved: boolean;
  images?: string[];
  notes?: string | null;
  rootCause?: string | null;
  nextStep?: string | null;
}

// ─── Quotes & Work Orders Types ─────────────────────────────────────────────

/** Status of a quote request/response */
export type QuoteStatus = 'requested' | 'quoted' | 'approved' | 'rejected';

/** Currency of a quote */
export type QuoteCurrency = 'CLP' | 'USD';

/** Status of a work order */
export type WorkOrderStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  'requested',
  'quoted',
  'approved',
  'rejected',
] as const;

export const QUOTE_CURRENCIES: readonly QuoteCurrency[] = ['CLP', 'USD'] as const;

export const WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  'open',
  'in_progress',
  'done',
  'cancelled',
] as const;

/** A single material line inside a quote item (stored as JSONB) */
export interface QuoteMaterial {
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

/** A quote line item, one per selected defect */
export interface QuoteItem {
  id: string;
  quote_id: string;
  defect_id: string | null;
  labor_hours: number;
  hourly_rate: number;
  labor_subtotal: number;
  materials: QuoteMaterial[];
  materials_subtotal: number;
  item_total: number;
  created_at: string;
  /** Enriched: defect info for display */
  defect?: {
    id: string;
    type: string;
    typeLabel: string;
    severity: number;
    side: string;
    distanceFromRoot: number;
    widthCm: number | null;
    heightCm: number | null;
    bladePosition: string;
    description: string | null;
  } | null;
}

/** A quote (request or response) */
export interface Quote {
  id: string;
  turbine_id: string | null;
  wind_farm_id: string | null;
  requested_by: string | null;
  status: QuoteStatus;
  currency: QuoteCurrency;
  quoted_by: string | null;
  quoted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  /** Enriched fields for lists/detail */
  turbineName?: string;
  windFarmName?: string;
  requestedByName?: string;
  itemsCount?: number;
  items?: QuoteItem[];
}

/** A work order generated from an approved quote */
export interface WorkOrder {
  id: string;
  quote_id: string | null;
  quote_item_id: string | null;
  defect_id: string | null;
  turbine_id: string | null;
  wind_farm_id: string | null;
  blade_side: string | null;
  cost_amount: number;
  currency: QuoteCurrency;
  status: WorkOrderStatus;
  created_at: string;
  updated_at: string;
}

/** Defect available for quoting (left column in the new quote screen) */
export interface QuotableDefect {
  id: string;
  type: string;
  typeLabel: string;
  severity: number;
  side: string;
  bladePosition: string;
  distanceFromRoot: number;
  widthCm: number | null;
  heightCm: number | null;
  description: string | null;
}

/** Traceability row aggregating work orders and costs */
export interface TraceabilityRow {
  key: string;
  windFarmId: string | null;
  windFarmName: string;
  turbineId: string | null;
  turbineName: string;
  bladeSide: string;
  defectType: string;
  status: WorkOrderStatus;
  cost: number;
  currency: QuoteCurrency;
  createdAt: string;
}

/** Cost aggregation summary for traceability */
export interface TraceabilitySummary {
  byTurbine: { turbineId: string; turbineName: string; total: number; count: number }[];
  byWindFarm: { windFarmId: string; windFarmName: string; total: number; count: number }[];
  rows: TraceabilityRow[];
  currency: QuoteCurrency;
}
