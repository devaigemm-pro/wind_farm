import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Asset Schemas ──────────────────────────────────────────────────────────

export const windFarmSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().min(1, 'Location is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type WindFarmFormData = z.infer<typeof windFarmSchema>;

export const turbineSchema = z.object({
  wind_farm_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  model: z.string().optional(),
});

export type TurbineFormData = z.infer<typeof turbineSchema>;

// ─── Inspection Schemas ─────────────────────────────────────────────────────

export const inspectionSchema = z.object({
  blade_id: z.string().uuid('Please select a blade'),
  scheduled_date: z.string().min(1, 'Scheduled date is required'),
});

export type InspectionFormData = z.infer<typeof inspectionSchema>;

// ─── Defect Schemas ─────────────────────────────────────────────────────────

export const defectSchema = z.object({
  inspection_id: z.string().uuid(),
  type: z.enum([
    'le_erosion',
    'vortex',
    'paint_defect',
    'crack',
    'delamination',
    'lightning_damage',
    'other',
  ]),
  severity: z.number().int().min(1).max(5),
  distance_from_root: z.number().min(0, 'Distance must be non-negative'),
  description: z.string().optional(),
});

export type DefectFormData = z.infer<typeof defectSchema>;

// ─── New Campaign Inspection Schema (RF-002) ────────────────────────────────

export const newCampaignInspectionSchema = z.object({
  windFarmId: z.string().uuid('Must select a wind farm'),
  campaignName: z.string().min(1, 'Campaign name is required'),
  inspectionType: z.enum(['blades', 'tower']),
  inspectionMethod: z.enum(['skyvisor', 'external']),
  scheduledDate: z.string().min(1, 'Inspection date is required'),
  notes: z.string().optional().default(''),
  selectedTurbineIds: z
    .array(z.string().uuid())
    .min(1, 'At least one turbine must be selected'),
});

export type NewCampaignInspectionFormData = z.infer<typeof newCampaignInspectionSchema>;

// ─── Chilean RUT validation ─────────────────────────────────────────────────

/**
 * Validate a Chilean RUT (formato con dígito verificador, módulo 11).
 * Accepts values with or without dots and hyphen, e.g. "12.345.678-5",
 * "12345678-5" or "123456785". The verifier digit may be 0-9 or 'K'.
 */
export function validateRut(rut: string): boolean {
  if (!rut) return false;

  // Strip dots and hyphens, uppercase the verifier.
  const clean = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);

  if (!/^\d+$/.test(body)) return false;
  if (!/^[0-9K]$/.test(verifier)) return false;

  // Módulo 11 over the body digits, right to left, multipliers 2..7.
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  return expected === verifier;
}

// ─── Password strength (medium) ─────────────────────────────────────────────

/**
 * Validate a medium-strength password:
 *  - at least 8 characters
 *  - at least one lowercase letter
 *  - at least one uppercase letter
 *  - at least one digit
 */
export function validatePassword(password: string): boolean {
  if (!password || password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  return true;
}

// ─── Chilean RUT auto-format ────────────────────────────────────────────────

/**
 * Format a Chilean RUT as the user types, inserting the hyphen before the
 * verifier digit. Strips dots/hyphens first, keeps only digits + optional
 * trailing K, then rejoins as "<body>-<verifier>". Examples:
 *   "123456785"   -> "12345678-5"
 *   "12345678k"   -> "12345678-K"
 *   "1"           -> "1" (too short to split yet)
 */
export function formatRut(value: string): string {
  // Keep digits and K/k only.
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);
  return `${body}-${verifier}`;
}
