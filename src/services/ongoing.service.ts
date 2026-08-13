import { supabase } from '@/lib/supabase';
import type { InspectionStage } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OngoingInspectionItem {
  id: string;
  stage: InspectionStage;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  viewed_percent: number | null;
  turbine: {
    id: string;
    name: string;
    wind_farm: {
      id: string;
      name: string;
    } | null;
  } | null;
  campaign: {
    id: string;
    name: string;
  } | null;
  defects: { id: string }[];
}

export interface OngoingGroupedByFarm {
  windFarmId: string;
  windFarmName: string;
  items: OngoingInspectionItem[];
}

export type OngoingByStage = Record<string, OngoingGroupedByFarm[]>;

// ─── Service ────────────────────────────────────────────────────────────────

export const ongoingService = {
  /**
   * Fetch all in_progress inspections grouped by stage (planned → analyze).
   * Mirrors Skyvisor's original logic: columns are workflow stages.
   */
  async getOngoingInspections(): Promise<OngoingByStage> {
    const { data, error } = await supabase
      .from('inspection')
      .select(
        `
        id, stage, status, scheduled_date, created_at,
        viewed_percent,
        turbine:turbine!inspection_turbine_id_fkey(
          id, name,
          wind_farm:wind_farm!turbine_wind_farm_id_fkey(id, name)
        ),
        campaign:campaign!inspection_campaign_id_fkey(id, name),
        defects:defect(id)
      `,
      )
      .in('stage', ['planned', 'inspect', 'annotate', 'analyze', 'report'])
      .eq('status', 'in_progress');

    if (error) throw new Error(error.message);

    const inspections = (data ?? []) as unknown as OngoingInspectionItem[];

    // Group by stage → wind farm
    const stages: InspectionStage[] = ['planned', 'inspect', 'annotate', 'analyze', 'report'];
    const result: OngoingByStage = {};

    for (const stage of stages) {
      const stageItems = inspections.filter((i) => i.stage === stage);
      const farmMap = new Map<string, OngoingGroupedByFarm>();

      for (const item of stageItems) {
        const farmId = item.turbine?.wind_farm?.id ?? 'unknown';
        const farmName = item.turbine?.wind_farm?.name ?? 'Unknown Farm';

        if (!farmMap.has(farmId)) {
          farmMap.set(farmId, { windFarmId: farmId, windFarmName: farmName, items: [] });
        }
        farmMap.get(farmId)!.items.push(item);
      }

      result[stage] = Array.from(farmMap.values());
    }

    return result;
  },
};
