import { supabase } from '@/lib/supabase';

export interface DashboardFilters {
  types?: string[];
  farms?: string[];
  models?: string[];
  severity?: number;
}

// ─── Chart-specific shapes matching what each Recharts component expects ────

export interface PipelineItem {
  stage: string;
  count: number;
}

export interface OperationsItem {
  month: string;
  planned: number;
  done: number;
  toPlan: number;
}

export interface SubassetStatusItem {
  name: string;
  value: number;
}

export interface DefectsSpreadItem {
  category: string;
  sev1: number;
  sev2: number;
  sev3: number;
  sev4: number;
  sev5: number;
  [key: string]: string | number;
}

// ─── Helper: get blade IDs matching farm/model filters ──────────────────────

// Sub-asset types supported in the system. Currently only "blades" has data.
const SUPPORTED_SUBASSET_TYPES = ['blades'];

/**
 * Checks if the types filter allows data to pass through.
 * Since all inspections are associated with blades:
 * - types includes 'blades' → allow data (return true)
 * - types has only unsupported values (tower, nacelle) → no data (return false)
 * - types is empty/undefined → allow all (return true)
 */
function typesFilterAllowsData(types?: string[]): boolean {
  if (!types || types.length === 0) return true;
  return types.some((t) => SUPPORTED_SUBASSET_TYPES.includes(t));
}

async function getFilteredBladeIds(
  filters: DashboardFilters,
): Promise<string[] | null> {
  const needsFilter = filters.farms?.length || filters.models?.length;
  if (!needsFilter) return null; // null means "no filter needed"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  let query = db.from('blade').select('id, turbine:turbine_id(id, model, wind_farm_id)');

  const { data: blades } = await query;
  if (!blades || blades.length === 0) return [];

  const filtered = (blades as Array<{
    id: string;
    turbine: { id: string; model: string; wind_farm_id: string } | null;
  }>).filter((b) => {
    if (!b.turbine) return false;
    if (filters.farms?.length && !filters.farms.includes(b.turbine.wind_farm_id)) {
      return false;
    }
    if (filters.models?.length && !filters.models.includes(b.turbine.model)) {
      return false;
    }
    return true;
  });

  return filtered.map((b) => b.id);
}

// ─── Per-chart methods ──────────────────────────────────────────────────────

export const dashboardService = {
  async getInspectionPipeline(
    filters?: DashboardFilters,
  ): Promise<PipelineItem[]> {
    const ALL_STAGES = ['to_plan', 'planned', 'upload', 'annotate', 'analyze', 'finalized'];

    // If types filter excludes blades, return empty (all data is blade-based)
    if (filters?.types?.length && !typesFilterAllowsData(filters.types)) {
      return ALL_STAGES.map((stage) => ({ stage, count: 0 }));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    let query = db.from('inspection').select('id, stage, blade_id');

    // Apply blade-level filters (farm, model)
    if (filters?.farms?.length || filters?.models?.length) {
      const bladeIds = await getFilteredBladeIds(filters);
      if (bladeIds !== null) {
        if (bladeIds.length === 0) {
          return ALL_STAGES.map((stage) => ({ stage, count: 0 }));
        }
        query = query.in('blade_id', bladeIds);
      }
    }

    const { data: inspections, error } = await query;
    if (error) throw error;

    // Count by stage
    const counts = new Map<string, number>();
    for (const stage of ALL_STAGES) {
      counts.set(stage, 0);
    }
    for (const insp of (inspections ?? []) as Array<{ id: string; stage: string }>) {
      const current = counts.get(insp.stage) ?? 0;
      counts.set(insp.stage, current + 1);
    }

    return ALL_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
  },

  async getDefectsSpread(
    filters?: DashboardFilters,
  ): Promise<DefectsSpreadItem[]> {
    // If types filter excludes blades, return empty (all data is blade-based)
    if (filters?.types?.length && !typesFilterAllowsData(filters.types)) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    let query = db.from('defect').select('id, type, severity, inspection_id');

    // Apply severity filter
    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }

    const { data: defects, error } = await query;
    if (error) throw error;

    let filteredDefects = (defects ?? []) as Array<{
      id: string;
      type: string;
      severity: number;
      inspection_id: string;
    }>;

    // Apply farm/model filters via inspection→blade→turbine chain
    if (filters?.farms?.length || filters?.models?.length) {
      const bladeIds = await getFilteredBladeIds(filters);
      if (bladeIds !== null) {
        if (bladeIds.length === 0) return [];

        // Get inspection IDs that belong to those blades
        const { data: inspections } = await db
          .from('inspection')
          .select('id')
          .in('blade_id', bladeIds);

        const inspectionIds = new Set(
          ((inspections ?? []) as Array<{ id: string }>).map((i) => i.id),
        );
        filteredDefects = filteredDefects.filter((d) => inspectionIds.has(d.inspection_id));
      }
    }

    // Pivot into per-type rows with sev1..sev5
    const byType = new Map<string, DefectsSpreadItem>();
    for (const d of filteredDefects) {
      let row = byType.get(d.type);
      if (!row) {
        row = { category: d.type, sev1: 0, sev2: 0, sev3: 0, sev4: 0, sev5: 0 };
        byType.set(d.type, row);
      }
      const key = `sev${d.severity}` as 'sev1' | 'sev2' | 'sev3' | 'sev4' | 'sev5';
      if (key in row) {
        (row[key] as number) += 1;
      }
    }
    return Array.from(byType.values());
  },

  async getInspectionOperations(
    filters?: DashboardFilters,
  ): Promise<OperationsItem[]> {
    // If types filter excludes blades, return empty (all data is blade-based)
    if (filters?.types?.length && !typesFilterAllowsData(filters.types)) {
      return generateEmptyMonths();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    let query = db.from('inspection').select('id, stage, scheduled_date, blade_id');

    // Apply blade-level filters
    if (filters?.farms?.length || filters?.models?.length) {
      const bladeIds = await getFilteredBladeIds(filters);
      if (bladeIds !== null) {
        if (bladeIds.length === 0) {
          return generateEmptyMonths();
        }
        query = query.in('blade_id', bladeIds);
      }
    }

    const { data: inspections, error } = await query;
    if (error) throw error;

    // Group by month
    const monthMap = new Map<string, { planned: number; done: number; toPlan: number }>();

    for (const insp of (inspections ?? []) as Array<{
      id: string;
      stage: string;
      scheduled_date: string | null;
    }>) {
      const date = insp.scheduled_date ? new Date(insp.scheduled_date) : null;
      if (!date || isNaN(date.getTime())) continue;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { planned: 0, done: 0, toPlan: 0 });
      }
      const entry = monthMap.get(monthKey)!;

      if (insp.stage === 'to_plan') {
        entry.toPlan += 1;
      } else if (insp.stage === 'finalized') {
        entry.done += 1;
      } else if (insp.stage === 'planned') {
        entry.planned += 1;
      }
    }

    // Return last 12 months sorted
    const sortedKeys = Array.from(monthMap.keys()).sort();
    const last12 = sortedKeys.slice(-12);

    return last12.map((key) => {
      const entry = monthMap.get(key)!;
      // Format month label as "MMM YY"
      const [year, month] = key.split('-');
      const date = new Date(Number(year), Number(month) - 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { month: label, ...entry };
    });
  },

  async getSubassetsStatus(
    filters?: DashboardFilters,
  ): Promise<SubassetStatusItem[]> {
    // If types filter excludes blades, return empty (all data is blade-based)
    if (filters?.types?.length && !typesFilterAllowsData(filters.types)) {
      return [
        { name: 'recent', value: 0 },
        { name: 'moderate', value: 0 },
        { name: 'overdue', value: 0 },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Get all blades, optionally filtered
    let bladeQuery = db.from('blade').select('id, turbine:turbine_id(id, model, wind_farm_id)');
    const { data: allBlades } = await bladeQuery;

    let blades = (allBlades ?? []) as Array<{
      id: string;
      turbine: { id: string; model: string; wind_farm_id: string } | null;
    }>;

    // Apply farm/model filters
    if (filters?.farms?.length || filters?.models?.length) {
      blades = blades.filter((b) => {
        if (!b.turbine) return false;
        if (filters.farms?.length && !filters.farms.includes(b.turbine.wind_farm_id)) {
          return false;
        }
        if (filters.models?.length && !filters.models.includes(b.turbine.model)) {
          return false;
        }
        return true;
      });
    }

    if (blades.length === 0) {
      return [
        { name: 'recent', value: 0 },
        { name: 'moderate', value: 0 },
        { name: 'overdue', value: 0 },
      ];
    }

    const bladeIds = blades.map((b) => b.id);

    // Get all inspections for these blades
    const { data: inspections } = await db
      .from('inspection')
      .select('id, blade_id, scheduled_date')
      .in('blade_id', bladeIds);

    // Find the latest inspection date per blade
    const latestByBlade = new Map<string, Date>();
    for (const insp of (inspections ?? []) as Array<{
      id: string;
      blade_id: string;
      scheduled_date: string | null;
    }>) {
      if (!insp.scheduled_date) continue;
      const date = new Date(insp.scheduled_date);
      if (isNaN(date.getTime())) continue;
      const current = latestByBlade.get(insp.blade_id);
      if (!current || date > current) {
        latestByBlade.set(insp.blade_id, date);
      }
    }

    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let recent = 0;
    let moderate = 0;
    let overdue = 0;

    for (const bladeId of bladeIds) {
      const lastDate = latestByBlade.get(bladeId);
      if (!lastDate) {
        overdue += 1;
      } else if (lastDate >= threeMonthsAgo) {
        recent += 1;
      } else if (lastDate >= sixMonthsAgo) {
        moderate += 1;
      } else {
        overdue += 1;
      }
    }

    return [
      { name: 'recent', value: recent },
      { name: 'moderate', value: moderate },
      { name: 'overdue', value: overdue },
    ];
  },
};

// Helper: generate empty months array
function generateEmptyMonths(): OperationsItem[] {
  const months: OperationsItem[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push({ month: label, planned: 0, done: 0, toPlan: 0 });
  }
  return months;
}
