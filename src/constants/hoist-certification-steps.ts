/**
 * The FIXED hoist-certification structure ("Certificación de polipastos") for a
 * turbine, in strict order.
 *
 * Unlike cleaning (a hierarchy of ZONES whose leaves hold only photos), a hoist
 * certification is organized as an ordered set of STEPS (pasos). A step may hold
 * ITEMS directly, or group them under an optional SUB-GROUP (grupo). The leaves
 * of this tree are TYPED ITEMS — the key modeling difference vs cleaning:
 *
 *   • itemType 'photo'        → the mobile app captures one or more photos only
 *                               (same as a cleaning zone).
 *   • itemType 'check'        → the mobile app captures a boolean pass/fail
 *                               (cumple / no cumple). May also carry photos.
 *   • itemType 'measurement'  → the mobile app captures a numeric/text value
 *                               plus one or more photos.
 *
 * The web app NEVER writes these items; the technician mobile app owns them (see
 * the DATA CONTRACT in hoistCertification.service.ts). This catalog mirrors
 * cleaning-zones.ts (CLEANING_ZONE_CATALOG): it is the UI skeleton AND the
 * graceful-degradation fallback shown when the mobile RPC/table aren't shipped
 * yet (empty items rendered from the catalog). The structure is identical for
 * every turbine and never changes.
 *
 * Hierarchy: STEP (paso) → (optional SUB-GROUP) → typed ITEM.
 *   - Step with items directly   → items have parentCode === <step code>.
 *   - Step with sub-groups       → groups have parentCode === <step code>, and
 *                                  items have parentCode === <group code>.
 */

export type HoistItemType = 'photo' | 'check' | 'measurement';

export interface HoistCertCatalogEntry {
  /** Stable code written by the mobile app (step/group/item code). snake_case. */
  code: string;
  labelEs: string;
  labelEn: string;
  sortOrder: number;
  /**
   * Parent code. Null for a top-level STEP. For a SUB-GROUP, the parent STEP
   * code. For an ITEM, either its STEP code (step without sub-groups) or its
   * GROUP code (step with sub-groups).
   */
  parentCode: string | null;
  /** Node kind. Exactly one of isStep / isGroup / isItem is true. */
  isStep: boolean;
  isGroup: boolean;
  isItem: boolean;
  /**
   * The item type — only meaningful when isItem === true (null for steps and
   * groups). Drives how the web renders the leaf (photo gallery / pass-fail
   * indicator / measurement value).
   */
  itemType: HoistItemType | null;
}

/**
 * The fixed hoist-certification catalog (sort_order ascending). From the field
 * sheet ("Certificación de polipastos"):
 *
 *   1. Preparativos
 *   2. Inspección Visual y mecánica
 *   3. Inspección Crítica  → sub-groups: Cadena de carga / Ojales de aluminio fundido
 *   4. Verificación de Torques
 *   5. Prueba de carga
 *   6. Certificación y cierre
 *
 * sortOrder is global so a flat ordering (steps interleaved with their groups
 * and items) is stable; the service/UI rebuild the tree from parentCode.
 */
export const HOIST_CERT_CATALOG: readonly HoistCertCatalogEntry[] = [
  // ── Paso 1: Preparativos ──────────────────────────────────────────────────
  { code: 'preparativos', labelEs: 'Preparativos', labelEn: 'Preparations', sortOrder: 1, parentCode: null, isStep: true, isGroup: false, isItem: false, itemType: null },
  { code: 'prep_viento', labelEs: 'Viento inferior a 15 m/s', labelEn: 'Wind below 15 m/s', sortOrder: 2, parentCode: 'preparativos', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },
  { code: 'prep_certificado_peso', labelEs: 'Certificado de peso patrón', labelEn: 'Standard weight certificate', sortOrder: 3, parentCode: 'preparativos', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },

  // ── Paso 2: Inspección Visual y mecánica ──────────────────────────────────
  { code: 'inspeccion_visual', labelEs: 'Inspección Visual y mecánica', labelEn: 'Visual and mechanical inspection', sortOrder: 10, parentCode: null, isStep: true, isGroup: false, isItem: false, itemType: null },
  { code: 'visual_caja_cadena', labelEs: 'Caja de cadena y suspensión', labelEn: 'Chain box and suspension', sortOrder: 11, parentCode: 'inspeccion_visual', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },
  { code: 'visual_gancho', labelEs: 'Gancho', labelEn: 'Hook', sortOrder: 12, parentCode: 'inspeccion_visual', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },
  { code: 'visual_goma_plastico', labelEs: 'Piezas de goma y plásticas', labelEn: 'Rubber and plastic parts', sortOrder: 13, parentCode: 'inspeccion_visual', isStep: false, isGroup: false, isItem: true, itemType: 'check' },
  { code: 'visual_cable_control', labelEs: 'Cable de control y colgante', labelEn: 'Control cable and pendant', sortOrder: 14, parentCode: 'inspeccion_visual', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },
  { code: 'visual_sin_ruido', labelEs: 'Funcionamiento sin ruido', labelEn: 'Operation without noise', sortOrder: 15, parentCode: 'inspeccion_visual', isStep: false, isGroup: false, isItem: true, itemType: 'check' },
  { code: 'visual_lubricacion_cadena', labelEs: 'Lubricación de cadena', labelEn: 'Chain lubrication', sortOrder: 16, parentCode: 'inspeccion_visual', isStep: false, isGroup: false, isItem: true, itemType: 'check' },
  { code: 'visual_nivel_aceite', labelEs: 'Nivel de aceite', labelEn: 'Oil level', sortOrder: 17, parentCode: 'inspeccion_visual', isStep: false, isGroup: false, isItem: true, itemType: 'check' },
  { code: 'visual_switch_limite', labelEs: 'Switch de límite de carrera', labelEn: 'Travel limit switch', sortOrder: 18, parentCode: 'inspeccion_visual', isStep: false, isGroup: false, isItem: true, itemType: 'check' },

  // ── Paso 3: Inspección Crítica (dos sub-grupos) ───────────────────────────
  { code: 'inspeccion_critica', labelEs: 'Inspección Crítica', labelEn: 'Critical inspection', sortOrder: 20, parentCode: null, isStep: true, isGroup: false, isItem: false, itemType: null },
  // Sub-grupo: Cadena de carga
  { code: 'cadena_carga', labelEs: 'Cadena de carga', labelEn: 'Load chain', sortOrder: 21, parentCode: 'inspeccion_critica', isStep: false, isGroup: true, isItem: false, itemType: null },
  { code: 'cadena_sin_desgaste', labelEs: 'Sin desgaste, abrasión, grietas, deformación ni eslabones rígidos', labelEn: 'No wear, abrasion, cracks, deformation or rigid links', sortOrder: 22, parentCode: 'cadena_carga', isStep: false, isGroup: false, isItem: true, itemType: 'measurement' },
  { code: 'cadena_espesor', labelEs: 'Espesor no inferior al 10%', labelEn: 'Thickness not below 10%', sortOrder: 23, parentCode: 'cadena_carga', isStep: false, isGroup: false, isItem: true, itemType: 'measurement' },
  { code: 'cadena_alargamiento', labelEs: 'Alargamiento no mayor al 5% o 2% en 11 eslabones', labelEn: 'Elongation not greater than 5% or 2% over 11 links', sortOrder: 24, parentCode: 'cadena_carga', isStep: false, isGroup: false, isItem: true, itemType: 'measurement' },
  { code: 'cadena_rueda_guia', labelEs: 'Rueda y guía de cadena sin desgaste excesivo', labelEn: 'Chain wheel and guide without excessive wear', sortOrder: 25, parentCode: 'cadena_carga', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },
  // Sub-grupo: Ojales de aluminio fundido
  { code: 'ojales_aluminio', labelEs: 'Ojales de aluminio fundido', labelEn: 'Cast aluminium eyelets', sortOrder: 26, parentCode: 'inspeccion_critica', isStep: false, isGroup: true, isItem: false, itemType: null },
  { code: 'ojales_tintas_penetrantes', labelEs: 'Inspección de grietas tintas penetrantes', labelEn: 'Dye penetrant crack inspection', sortOrder: 27, parentCode: 'ojales_aluminio', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },
  { code: 'ojales_arandela_seguro', labelEs: 'Reemplazar arandela y seguro', labelEn: 'Replace washer and lock', sortOrder: 28, parentCode: 'ojales_aluminio', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },
  { code: 'ojales_distancia', labelEs: 'Medir distancia de ojales y suspensión (menor a 2mm)', labelEn: 'Measure eyelet and suspension distance (less than 2mm)', sortOrder: 29, parentCode: 'ojales_aluminio', isStep: false, isGroup: false, isItem: true, itemType: 'check' },

  // ── Paso 4: Verificación de Torques ───────────────────────────────────────
  { code: 'verificacion_torques', labelEs: 'Verificación de Torques', labelEn: 'Torque verification', sortOrder: 40, parentCode: null, isStep: true, isGroup: false, isItem: false, itemType: null },
  { code: 'torque_caja_cadena', labelEs: 'Caja de cadena y suspensión', labelEn: 'Chain box and suspension', sortOrder: 41, parentCode: 'verificacion_torques', isStep: false, isGroup: false, isItem: true, itemType: 'check' },
  { code: 'torque_viga_transversal', labelEs: 'Viga transversal', labelEn: 'Cross beam', sortOrder: 42, parentCode: 'verificacion_torques', isStep: false, isGroup: false, isItem: true, itemType: 'check' },

  // ── Paso 5: Prueba de carga ───────────────────────────────────────────────
  { code: 'prueba_carga', labelEs: 'Prueba de carga', labelEn: 'Load test', sortOrder: 50, parentCode: null, isStep: true, isGroup: false, isItem: false, itemType: null },
  { code: 'carga_dinamica', labelEs: 'Prueba dinámica', labelEn: 'Dynamic test', sortOrder: 51, parentCode: 'prueba_carga', isStep: false, isGroup: false, isItem: true, itemType: 'check' },
  { code: 'carga_estatica', labelEs: 'Prueba estática (peso patrón)', labelEn: 'Static test (standard weight)', sortOrder: 52, parentCode: 'prueba_carga', isStep: false, isGroup: false, isItem: true, itemType: 'check' },

  // ── Paso 6: Certificación y cierre ────────────────────────────────────────
  { code: 'certificacion_cierre', labelEs: 'Certificación y cierre', labelEn: 'Certification and closure', sortOrder: 60, parentCode: null, isStep: true, isGroup: false, isItem: false, itemType: null },
  { code: 'cierre_pegatina', labelEs: 'Pegatina de certificación (verde ó rojo)', labelEn: 'Certification sticker (green or red)', sortOrder: 61, parentCode: 'certificacion_cierre', isStep: false, isGroup: false, isItem: true, itemType: 'photo' },
] as const;

/** Lookup map: code → catalog entry. */
export const HOIST_CERT_BY_CODE: Record<string, HoistCertCatalogEntry> =
  HOIST_CERT_CATALOG.reduce(
    (acc, e) => {
      acc[e.code] = e;
      return acc;
    },
    {} as Record<string, HoistCertCatalogEntry>,
  );

/** Ordered list of all codes (steps, groups and items interleaved). */
export const HOIST_CERT_CODES: readonly string[] = HOIST_CERT_CATALOG.map((e) => e.code);

/** Top-level steps (pasos), ordered. */
export const HOIST_CERT_STEPS: readonly HoistCertCatalogEntry[] =
  HOIST_CERT_CATALOG.filter((e) => e.isStep);

/** Direct SUB-GROUPS of a given step code, ordered (empty when the step has none). */
export function getHoistGroups(stepCode: string): HoistCertCatalogEntry[] {
  return HOIST_CERT_CATALOG.filter((e) => e.isGroup && e.parentCode === stepCode).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/** Direct ITEMS of a given parent code (a step without groups, or a group), ordered. */
export function getHoistItems(parentCode: string): HoistCertCatalogEntry[] {
  return HOIST_CERT_CATALOG.filter((e) => e.isItem && e.parentCode === parentCode).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/** Whether a step holds sub-groups (true) or items directly (false). */
export function hoistStepHasGroups(stepCode: string): boolean {
  return getHoistGroups(stepCode).length > 0;
}

/** Get the localized label for a hoist-certification code. Falls back to the code. */
export function getHoistLabel(code: string, locale: 'es' | 'en'): string {
  const entry = HOIST_CERT_BY_CODE[code];
  if (!entry) return code;
  return locale === 'es' ? entry.labelEs : entry.labelEn;
}
