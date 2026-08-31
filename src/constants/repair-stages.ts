/**
 * The 11 fixed repair stages (etapas de reparación) in strict order.
 *
 * Photos captured during a repair are stored in `inspection_photo` with
 * `repair_stage` set to one of these `key` values (null for inspection photos).
 * These are ALL the stages — the client confirmed there are no more.
 */

export interface RepairStage {
  key: string;
  labelEs: string;
  labelEn: string;
  order: number;
}

export const REPAIR_STAGES: readonly RepairStage[] = [
  { key: 'label', labelEs: 'Etiqueta', labelEn: 'Label', order: 1 },
  { key: 'failure_analysis', labelEs: 'Análisis de falla', labelEn: 'Failure analysis', order: 2 },
  { key: 'sanding', labelEs: 'Saneado', labelEn: 'Sanding', order: 3 },
  { key: 'lamination', labelEs: 'Laminación', labelEn: 'Lamination', order: 4 },
  { key: 'vacuum_system', labelEs: 'Sistema de vacío', labelEn: 'Vacuum system', order: 5 },
  { key: 'thermal_blanket', labelEs: 'Manta térmica inicio postcurado', labelEn: 'Thermal blanket (post-cure start)', order: 6 },
  { key: 'lamination_result', labelEs: 'Resultado de laminación', labelEn: 'Lamination result', order: 7 },
  { key: 'surface_post_lamination', labelEs: 'Ajustado de superficie post laminado', labelEn: 'Surface adjustment (post-lamination)', order: 8 },
  { key: 'filler_application', labelEs: 'Aplicación de filler', labelEn: 'Filler application', order: 9 },
  { key: 'surface_post_filler', labelEs: 'Ajustado de superficie post filler', labelEn: 'Surface adjustment (post-filler)', order: 10 },
  { key: 'paint_first_coat', labelEs: 'Aplicación de pintura primera mano', labelEn: 'Paint (first coat)', order: 11 },
] as const;

/** Ordered list of stage keys. */
export const REPAIR_STAGE_KEYS: readonly string[] = REPAIR_STAGES.map((s) => s.key);

/** Lookup map: stage key → RepairStage. */
export const REPAIR_STAGE_BY_KEY: Record<string, RepairStage> = REPAIR_STAGES.reduce(
  (acc, s) => {
    acc[s.key] = s;
    return acc;
  },
  {} as Record<string, RepairStage>,
);

/** Get the localized label for a repair stage key. */
export function getRepairStageLabel(key: string, locale: 'es' | 'en'): string {
  const stage = REPAIR_STAGE_BY_KEY[key];
  if (!stage) return key;
  return locale === 'es' ? stage.labelEs : stage.labelEn;
}

/**
 * The 11 fixed repair stages as written by the technician app (NEW data model).
 *
 * These `stage_code` values are the source of truth for the `repair_stage` /
 * `repair_photo` tables and the `repair_stage_catalog` table. They differ from
 * the legacy `REPAIR_STAGES.key` values above (which mapped the old
 * inspection_photo.repair_stage column). This constant is used only as a
 * fallback when a work_order/defect has no `repair` row yet, so the UI can
 * still render the 11 empty stages without querying the DB catalog.
 */
export interface RepairStageCatalogEntry {
  code: string;
  labelEs: string;
  labelEn: string;
  sortOrder: number;
}

export const REPAIR_STAGE_CATALOG: readonly RepairStageCatalogEntry[] = [
  { code: 'etiqueta', labelEs: 'Etiqueta', labelEn: 'Label', sortOrder: 1 },
  { code: 'analisis_falla', labelEs: 'Análisis de falla', labelEn: 'Failure analysis', sortOrder: 2 },
  { code: 'saneado', labelEs: 'Saneado', labelEn: 'Sanding', sortOrder: 3 },
  { code: 'laminacion', labelEs: 'Laminación', labelEn: 'Lamination', sortOrder: 4 },
  { code: 'sistema_vacio', labelEs: 'Sistema de vacío', labelEn: 'Vacuum system', sortOrder: 5 },
  { code: 'manta_termica', labelEs: 'Manta térmica', labelEn: 'Thermal blanket', sortOrder: 6 },
  { code: 'resultado_laminacion', labelEs: 'Resultado de laminación', labelEn: 'Lamination result', sortOrder: 7 },
  { code: 'ajuste_post_laminado', labelEs: 'Ajuste post laminado', labelEn: 'Adjustment (post-lamination)', sortOrder: 8 },
  { code: 'aplicacion_filler', labelEs: 'Aplicación de filler', labelEn: 'Filler application', sortOrder: 9 },
  { code: 'ajuste_post_filler', labelEs: 'Ajuste post filler', labelEn: 'Adjustment (post-filler)', sortOrder: 10 },
  { code: 'pintura_primera_mano', labelEs: 'Pintura primera mano', labelEn: 'Paint (first coat)', sortOrder: 11 },
] as const;

/** Lookup map: stage code → catalog entry. */
export const REPAIR_STAGE_CATALOG_BY_CODE: Record<string, RepairStageCatalogEntry> =
  REPAIR_STAGE_CATALOG.reduce(
    (acc, s) => {
      acc[s.code] = s;
      return acc;
    },
    {} as Record<string, RepairStageCatalogEntry>,
  );

/** Localized fallback label for a stage code (used when repair_stage.stage_label is null). */
export function getStageCatalogLabel(code: string, locale: 'es' | 'en'): string {
  const stage = REPAIR_STAGE_CATALOG_BY_CODE[code];
  if (!stage) return code;
  return locale === 'es' ? stage.labelEs : stage.labelEn;
}
