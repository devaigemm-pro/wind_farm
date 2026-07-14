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
