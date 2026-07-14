import { supabase } from '@/lib/supabase';

export interface DashboardFilters {
  types?: string[];
  farms?: string[];
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
  // Index signature matches the chart's expected shape so this type is
  // assignable to DefectsSpreadDataItem in the chart component.
  [key: string]: string | number;
}

// ─── Edge function invoker ──────────────────────────────────────────────────

type Chart =
  | 'inspection-pipeline'
  | 'defects-spread'
  | 'inspection-operations'
  | 'subassets-status';

async function invoke<T>(chart: Chart, filters?: DashboardFilters): Promise<T> {
  const { data, error } = await supabase.functions.invoke('dashboard-aggregate', {
    body: { chart, filters },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data as T;
}

// ─── Per-chart methods (each returns the exact array shape its chart needs) ─

export const dashboardService = {
  async getInspectionPipeline(
    filters?: DashboardFilters,
  ): Promise<PipelineItem[]> {
    const raw = await invoke<{ stages: PipelineItem[] }>(
      'inspection-pipeline',
      filters,
    );
    return raw.stages ?? [];
  },

  async getInspectionOperations(
    filters?: DashboardFilters,
  ): Promise<OperationsItem[]> {
    const raw = await invoke<{ months: OperationsItem[] }>(
      'inspection-operations',
      filters,
    );
    return raw.months ?? [];
  },

  async getSubassetsStatus(
    filters?: DashboardFilters,
  ): Promise<SubassetStatusItem[]> {
    const raw = await invoke<{ segments: { label: string; count: number }[] }>(
      'subassets-status',
      filters,
    );
    return (raw.segments ?? []).map((s) => ({ name: s.label, value: s.count }));
  },

  async getDefectsSpread(
    filters?: DashboardFilters,
  ): Promise<DefectsSpreadItem[]> {
    const raw = await invoke<{
      items: { type: string; severity: number; count: number }[];
    }>('defects-spread', filters);

    // Pivot { type, severity, count } rows into per-type rows with sev1..sev5.
    const byType = new Map<string, DefectsSpreadItem>();
    for (const it of raw.items ?? []) {
      let row = byType.get(it.type);
      if (!row) {
        row = {
          category: it.type,
          sev1: 0,
          sev2: 0,
          sev3: 0,
          sev4: 0,
          sev5: 0,
        };
        byType.set(it.type, row);
      }
      const key = `sev${it.severity}` as keyof Pick<
        DefectsSpreadItem,
        'sev1' | 'sev2' | 'sev3' | 'sev4' | 'sev5'
      >;
      if (key in row) {
        row[key] = (row[key] as number) + it.count;
      }
    }
    return Array.from(byType.values());
  },
};
