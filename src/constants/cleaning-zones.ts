/**
 * The FIXED cleaning zones (zonas de limpieza) for a turbine, in strict order.
 *
 * Unlike repairs (21 sequential stages), a cleaning campaign is organized as a
 * hierarchical set of ZONES (Palas / Nacelle / Hub / Torre). Some zones have
 * SUB-ZONES (leaf nodes where photos actually live); others are leaf zones
 * themselves (Hub / Torre) with no children.
 *
 * Photos captured during a cleaning campaign are written by the technician
 * mobile app into `cleaning_photo` with a `zone_code` equal to one of the
 * `code` values below (either a parent leaf zone code, or a sub-zone code).
 * These are the ONLY zones — they are identical for every turbine and never
 * change. This catalog mirrors `repair-stages.ts` (REPAIR_STAGE_CATALOG) and is
 * used both as the UI skeleton and as the graceful-degradation fallback when
 * the mobile RPCs don't return data yet (empty zones shown from the catalog).
 */

export interface CleaningZoneCatalogEntry {
  /** Stable code written by the mobile app into cleaning_photo.zone_code. */
  code: string;
  labelEs: string;
  labelEn: string;
  sortOrder: number;
  /**
   * Parent zone code for a SUB-ZONE. Null for top-level zones (Palas / Nacelle /
   * Hub / Torre). A top-level zone with no sub-zones (Hub / Torre) is a LEAF
   * zone: photos attach directly to it. A top-level zone WITH sub-zones (Palas /
   * Nacelle) is a container: photos attach to its sub-zones, never to itself.
   */
  parentCode: string | null;
  /**
   * True when this entry is a top-level zone (parentCode === null). Convenience
   * flag mirroring repair's `optional` boolean so consumers don't have to
   * null-check parentCode everywhere.
   */
  isRoot: boolean;
  /**
   * True when photos attach DIRECTLY to this zone (a sub-zone, or a root zone
   * with no children like Hub / Torre). False for container root zones that
   * only group sub-zones (Palas / Nacelle).
   */
  isLeaf: boolean;
}

/**
 * The fixed cleaning zone catalog (sort_order ascending). Hierarchy:
 *   - Palas (container) → A, B, C
 *   - Nacelle (container) → Lado derecho, Lado inferior, Lado izquierdo, Lado trasero
 *   - Hub (leaf, no sub-zones)
 *   - Torre (leaf, no sub-zones)
 *
 * sortOrder is global so a flat ordering (zones interleaved with their
 * sub-zones) is stable; the service/UI rebuild the tree from parentCode.
 */
export const CLEANING_ZONE_CATALOG: readonly CleaningZoneCatalogEntry[] = [
  // ── Palas (container + 3 sub-zones A/B/C) ─────────────────────────────────
  { code: 'palas', labelEs: 'Palas', labelEn: 'Blades', sortOrder: 1, parentCode: null, isRoot: true, isLeaf: false },
  { code: 'palas_a', labelEs: 'Pala A', labelEn: 'Blade A', sortOrder: 2, parentCode: 'palas', isRoot: false, isLeaf: true },
  { code: 'palas_b', labelEs: 'Pala B', labelEn: 'Blade B', sortOrder: 3, parentCode: 'palas', isRoot: false, isLeaf: true },
  { code: 'palas_c', labelEs: 'Pala C', labelEn: 'Blade C', sortOrder: 4, parentCode: 'palas', isRoot: false, isLeaf: true },

  // ── Nacelle (container + 4 sub-zones) ─────────────────────────────────────
  { code: 'nacelle', labelEs: 'Nacelle', labelEn: 'Nacelle', sortOrder: 5, parentCode: null, isRoot: true, isLeaf: false },
  { code: 'nacelle_derecho', labelEs: 'Lado derecho', labelEn: 'Right side', sortOrder: 6, parentCode: 'nacelle', isRoot: false, isLeaf: true },
  { code: 'nacelle_inferior', labelEs: 'Lado inferior', labelEn: 'Bottom side', sortOrder: 7, parentCode: 'nacelle', isRoot: false, isLeaf: true },
  { code: 'nacelle_izquierdo', labelEs: 'Lado izquierdo', labelEn: 'Left side', sortOrder: 8, parentCode: 'nacelle', isRoot: false, isLeaf: true },
  { code: 'nacelle_trasero', labelEs: 'Lado trasero', labelEn: 'Rear side', sortOrder: 9, parentCode: 'nacelle', isRoot: false, isLeaf: true },

  // ── Hub (leaf zone, no sub-zones) ─────────────────────────────────────────
  { code: 'hub', labelEs: 'Hub', labelEn: 'Hub', sortOrder: 10, parentCode: null, isRoot: true, isLeaf: true },

  // ── Torre (leaf zone, no sub-zones) ───────────────────────────────────────
  { code: 'torre', labelEs: 'Torre', labelEn: 'Tower', sortOrder: 11, parentCode: null, isRoot: true, isLeaf: true },
] as const;

/** Lookup map: zone code → catalog entry. */
export const CLEANING_ZONE_BY_CODE: Record<string, CleaningZoneCatalogEntry> =
  CLEANING_ZONE_CATALOG.reduce(
    (acc, z) => {
      acc[z.code] = z;
      return acc;
    },
    {} as Record<string, CleaningZoneCatalogEntry>,
  );

/** Ordered list of all zone codes (roots and sub-zones interleaved). */
export const CLEANING_ZONE_CODES: readonly string[] = CLEANING_ZONE_CATALOG.map((z) => z.code);

/** Top-level zones (Palas / Nacelle / Hub / Torre), ordered. */
export const CLEANING_ROOT_ZONES: readonly CleaningZoneCatalogEntry[] =
  CLEANING_ZONE_CATALOG.filter((z) => z.isRoot);

/** Sub-zones of a given root zone code, ordered (empty for leaf roots). */
export function getCleaningSubZones(rootCode: string): CleaningZoneCatalogEntry[] {
  return CLEANING_ZONE_CATALOG.filter((z) => z.parentCode === rootCode).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/** Get the localized label for a cleaning zone code. Falls back to the code. */
export function getCleaningZoneLabel(code: string, locale: 'es' | 'en'): string {
  const zone = CLEANING_ZONE_BY_CODE[code];
  if (!zone) return code;
  return locale === 'es' ? zone.labelEs : zone.labelEn;
}
