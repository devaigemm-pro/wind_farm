import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CampaignTurbineResult } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CampaignData {
  id: string;
  name: string;
  windFarmId: string;
  windFarmName: string;
  createdAt: string;
}

interface CampaignDefect {
  id: string;
  turbineId: string;
  turbineName: string;
  bladePosition: number;
  type: string;
  severity: number;
  distanceFromRoot: number;
  widthCm: number;
  heightCm: number;
  side: string;
  description: string | null;
  imagePaths: string[];
}

interface CategoryChartItem {
  turbine: string;
  cat5: number;
  cat4: number;
  cat3: number;
  cat2: number;
  cat1: number;
}

interface TypeChartItem {
  turbine: string;
  le_erosion: number;
  crack: number;
  delamination: number;
  lightning_damage: number;
  vortex: number;
  paint_defect: number;
  oil: number;
  other: number;
}

interface CampaignResultsData {
  campaign: CampaignData | null;
  turbineResults: CampaignTurbineResult[];
  summary: Record<number, number>;
  totalDefects: number;
  resolvedCount: number;
  categoryChart: CategoryChartItem[];
  typeChart: TypeChartItem[];
  defects: CampaignDefect[];
}

// ─── Fetcher ────────────────────────────────────────────────────────────────

async function fetchCampaignResults(campaignId: string): Promise<CampaignResultsData> {
  // 1. Fetch campaign with wind farm info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: campaignRow, error: campaignErr } = await db
    .from('campaign')
    .select('id, name, created_at, wind_farm:wind_farm_id(id, name)')
    .eq('id', campaignId)
    .single();

  if (campaignErr || !campaignRow) {
    return {
      campaign: null,
      turbineResults: [],
      summary: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalDefects: 0,
      resolvedCount: 0,
      categoryChart: [],
      typeChart: [],
      defects: [],
    };
  }

  const cr = campaignRow as Record<string, unknown>;
  const windFarm = cr.wind_farm as Record<string, unknown> | null;

  const campaign: CampaignData = {
    id: cr.id as string,
    name: cr.name as string,
    windFarmId: (windFarm?.id as string) ?? '',
    windFarmName: (windFarm?.name as string) ?? '',
    createdAt: cr.created_at as string,
  };

  // 2. Fetch inspections for this campaign with blade/turbine/defect info
  const { data: inspections, error: inspErr } = await db
    .from('inspection')
    .select(`
      id,
      blade:blade!inspection_blade_id_fkey(
        position,
        turbine:turbine!blade_turbine_id_fkey(id, name)
      ),
      defects:defect(id, type, severity, distance_from_root, width_cm, height_cm, side, description, resolved, defect_image(evidence:evidence_id(storage_path)))
    `)
    .eq('campaign_id', campaignId);

  if (inspErr || !inspections || (inspections as unknown[]).length === 0) {
    return {
      campaign,
      turbineResults: [],
      summary: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalDefects: 0,
      resolvedCount: 0,
      categoryChart: [],
      typeChart: [],
      defects: [],
    };
  }

  // 3. Aggregate defects by turbine and blade
  const turbineMap = new Map<string, {
    id: string;
    name: string;
    blades: Map<number, { defects: Array<{ severity: number; type: string; resolved: boolean }> }>;
    allDefects: CampaignDefect[];
  }>();

  for (const insp of inspections as unknown[]) {
    const row = insp as Record<string, unknown>;
    const blade = row.blade as Record<string, unknown> | null;
    const turbine = blade?.turbine as Record<string, unknown> | null;
    const defects = (row.defects as unknown[]) ?? [];
    if (!turbine) continue;

    const turbineId = turbine.id as string;
    const turbineName = turbine.name as string;
    const bladePosition = Number(blade?.position) || 1;

    if (!turbineMap.has(turbineId)) {
      turbineMap.set(turbineId, { id: turbineId, name: turbineName, blades: new Map(), allDefects: [] });
    }
    const turbineData = turbineMap.get(turbineId)!;

    if (!turbineData.blades.has(bladePosition)) {
      turbineData.blades.set(bladePosition, { defects: [] });
    }
    const bladeData = turbineData.blades.get(bladePosition)!;

    for (const d of defects) {
      const defect = d as Record<string, unknown>;
      const severity = Number(defect.severity) || 1;
      const type = (defect.type as string) ?? 'other';
      const resolved = (defect.resolved as boolean) ?? false;

      // Extract image storage paths from defect_image → evidence
      const defectImages = (defect.defect_image as unknown[]) ?? [];
      const imagePaths: string[] = [];
      for (const di of defectImages) {
        const diRow = di as Record<string, unknown>;
        const evidence = diRow.evidence as Record<string, unknown> | null;
        if (evidence?.storage_path) {
          imagePaths.push(evidence.storage_path as string);
        }
      }

      bladeData.defects.push({ severity, type, resolved });
      turbineData.allDefects.push({
        id: defect.id as string,
        turbineId,
        turbineName,
        bladePosition,
        type,
        severity,
        distanceFromRoot: Number(defect.distance_from_root) || 0,
        widthCm: Number(defect.width_cm) || 0,
        heightCm: Number(defect.height_cm) || 0,
        side: (defect.side as string) ?? 'LE',
        description: defect.description as string | null,
        imagePaths,
      });
    }
  }

  // 4. Build turbine results
  const BLADE_LABELS: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };
  const turbineResults: CampaignTurbineResult[] = [];
  const allDefects: CampaignDefect[] = [];

  for (const [, td] of turbineMap) {
    const defectsByCat: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let resolvedCount = 0;
    let totalDefects = 0;

    const blades: CampaignTurbineResult['blades'] = [];
    for (const [pos, bladeData] of td.blades) {
      const bladeCat: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let bladeResolved = 0;
      for (const d of bladeData.defects) {
        bladeCat[d.severity] = (bladeCat[d.severity] ?? 0) + 1;
        defectsByCat[d.severity] = (defectsByCat[d.severity] ?? 0) + 1;
        if (d.resolved) {
          resolvedCount++;
          bladeResolved++;
        }
        totalDefects++;
      }
      blades.push({
        position: BLADE_LABELS[pos] ?? String(pos),
        defectsByCat: bladeCat,
        resolvedCount: bladeResolved,
        totalDefects: bladeData.defects.length,
      });
    }

    // Sort blades by position label
    blades.sort((a, b) => a.position.localeCompare(b.position));

    turbineResults.push({
      turbineId: td.id,
      turbineName: td.name,
      defectsByCat,
      resolvedCount,
      totalDefects,
      blades,
    });

    allDefects.push(...td.allDefects);
  }

  // Sort turbines by name
  turbineResults.sort((a, b) => a.turbineName.localeCompare(b.turbineName));

  // 5. Build summary
  const summary: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalResolvedCount = 0;
  let totalDefectsCount = 0;
  for (const tr of turbineResults) {
    for (const cat of [1, 2, 3, 4, 5]) {
      summary[cat] = (summary[cat] ?? 0) + (tr.defectsByCat[cat] ?? 0);
    }
    totalResolvedCount += tr.resolvedCount;
    totalDefectsCount += tr.totalDefects;
  }

  // 6. Build category chart
  const categoryChart: CategoryChartItem[] = turbineResults.map((t) => ({
    turbine: t.turbineName.replace('Turbine ', ''),
    cat5: t.defectsByCat[5] ?? 0,
    cat4: t.defectsByCat[4] ?? 0,
    cat3: t.defectsByCat[3] ?? 0,
    cat2: t.defectsByCat[2] ?? 0,
    cat1: t.defectsByCat[1] ?? 0,
  }));

  // 7. Build type chart
  const typeChart: TypeChartItem[] = turbineResults.map((t) => {
    const typeCounts: Record<string, number> = {};
    const td = turbineMap.get(t.turbineId)!;
    for (const d of td.allDefects) {
      typeCounts[d.type] = (typeCounts[d.type] ?? 0) + 1;
    }
    return {
      turbine: t.turbineName.replace('Turbine ', ''),
      le_erosion: typeCounts['le_erosion'] ?? 0,
      crack: typeCounts['crack'] ?? 0,
      delamination: typeCounts['delamination'] ?? 0,
      lightning_damage: typeCounts['lightning_damage'] ?? 0,
      vortex: typeCounts['vortex'] ?? 0,
      paint_defect: typeCounts['paint_defect'] ?? 0,
      oil: typeCounts['oil'] ?? 0,
      other: typeCounts['other'] ?? 0,
    };
  });

  return {
    campaign,
    turbineResults,
    summary,
    totalDefects: totalDefectsCount,
    resolvedCount: totalResolvedCount,
    categoryChart,
    typeChart,
    defects: allDefects,
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCampaignResults(campaignId: string | undefined) {
  return useQuery<CampaignResultsData>({
    queryKey: ['campaign-results', campaignId],
    queryFn: () => fetchCampaignResults(campaignId!),
    enabled: !!campaignId,
    staleTime: 30_000,
  });
}
