/**
 * Application-level types, enums, and constants for Wind Blade Inspection.
 */

import type { Tables } from './supabase';

// ─── Shared Type Aliases (union types matching DB constraints) ───────────────

export type UserRole = 'inspector' | 'supervisor' | 'admin';

export type InspectionStatus = 'in_progress' | 'completed' | 'approved';

export type InspectionStage =
  | 'to_plan'
  | 'planned'
  | 'uploaded'
  | 'annotated'
  | 'analyzed'
  | 'finalized';

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

export const USER_ROLES: readonly UserRole[] = ['inspector', 'supervisor', 'admin'] as const;

export const INSPECTION_STATUSES: readonly InspectionStatus[] = [
  'in_progress',
  'completed',
  'approved',
] as const;

export const INSPECTION_STAGES: readonly InspectionStage[] = [
  'to_plan',
  'planned',
  'uploaded',
  'annotated',
  'analyzed',
  'finalized',
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
  blade?: Blade;
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
  type: ReportType;
}

// ─── Asset Tree Types ───────────────────────────────────────────────────────

export interface AssetTreeNode {
  id: string;
  name: string;
  type: 'wind_farm' | 'turbine' | 'blade';
  children?: AssetTreeNode[];
}
