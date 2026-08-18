import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CampaignTurbineResult } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

// Map annotation type labels (stored in DB) to chart keys
const ANNOTATION_TYPE_TO_CHART_KEY: Record<string, string> = {
  'LE EROSION': 'le_erosion',
  'LE TAPE': 'le_erosion',
  'TE EROSION': 'le_erosion',
  'LONGITUDINAL CRACKS ON LE OR TE BOND LINES': 'crack',
  'CRACK': 'crack',
  'CRACK ON V-PROFILE': 'crack',
  '45° CRACKS ON SURFACE (CUTTING FROM FACTORY)': 'crack',
  'OTHER CRACKS ON SURFACE': 'crack',
  'OPEN BOND LINE IN TE': 'crack',
  'VORTEX (MISSING PANELS)': 'vortex',
  'PAINT DAMAGES': 'paint_defect',
  'BLADES WITH HYDRAULIC OIL': 'oil',
  'OTHER ADD-ONS MISSING': 'other',
  'OTHER': 'other',
  'PINHOLES': 'other',
  'VOIDS': 'other',
  'BOLT LOOSE/MISSING': 'other',
  'CLOGGED DRAIN HOLE': 'other',
  'DELAMINATION': 'delamination',
  'LIGHTNING DAMAGE': 'lightning_damage',
  // snake_case fallbacks (in case data was stored in this format)
  'le_erosion': 'le_erosion',
  'crack': 'crack',
  'vortex': 'vortex',
  'paint_defect': 'paint_defect',
  'oil': 'oil',
  'delamination': 'delamination',
  'lightning_damage': 'lightning_damage',
  'other': 'other',
};

function normalizeAnnotationType(raw: string): string {
  return ANNOTATION_TYPE_TO_CHART_KEY[raw] ?? ANNOTATION_TYPE_TO_CHART_KEY[raw.toUpperCase()] ?? 'other';
}

interface CampaignData {
  id: string;
  name: string;
  windFarmId: string;
  windFarmName: string;
  createdAt: string;
}

interface CampaignDefect {
  id: string;
  inspectionId: string;
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
  turbineInspectionMap: Record<string, string>;
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
      turbineInspectionMap: {},
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

  // 2. Fetch inspections for this campaign with blade/turbine info
  const { data: inspections, error: inspErr } = await db
    .from('inspection')
    .select(`
      id,
      turbine_id,
      blade:blade!inspection_blade_id_fkey(
        id,
        position,
        turbine:turbine!blade_turbine_id_fkey(id, name)
      ),
      direct_turbine:turbine!inspection_turbine_id_fkey(id, name)
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
      turbineInspectionMap: {},
    };
  }

  // 2b. Fetch annotations for all inspections in this campaign
  const inspectionIds = (inspections as unknown[]).map((i) => (i as Record<string, unknown>).id as string);
  const { data: annotations } = await db
    .from('annotation')
    .select('id, inspection_id, thumbnail_id, type, category, note, side, x, y, w, h')
    .in('inspection_id', inspectionIds);

  // 2c. Resolve photo URLs from thumbnail_ids
  const thumbnailIds = ((annotations ?? []) as unknown[])
    .map((a) => (a as Record<string, unknown>).thumbnail_id as string)
    .filter((id) => id && id.includes('-')); // only UUIDs

  // Build photo → blade position map
  const photoBladePosMap = new Map<string, number>();
  const photoUrlMap = new Map<string, string>();
  if (thumbnailIds.length > 0) {
    const { data: photos } = await db
      .from('inspection_photo')
      .select('id, storage_path, blade_id')
      .in('id', thumbnailIds);

    if (photos && (photos as unknown[]).length > 0) {
      const paths = (photos as Record<string, unknown>[]).map((p) => p.storage_path as string);
      const { data: signedData } = await supabase.storage
        .from('asset-documents')
        .createSignedUrls(paths, 3600);

      if (signedData) {
        for (let i = 0; i < signedData.length; i++) {
          const url = signedData[i]?.signedUrl;
          const photo = (photos as Record<string, unknown>[])[i];
          if (url && photo) {
            photoUrlMap.set(photo.id as string, url);
          }
        }
      }

      // Build blade position map from photos
      const bladeIds = [...new Set((photos as Record<string, unknown>[]).map((p) => p.blade_id as string).filter(Boolean))];
      if (bladeIds.length > 0) {
        const { data: blades } = await db.from('blade').select('id, position').in('id', bladeIds);
        const bladeIdToPos = new Map<string, number>();
        if (blades) for (const b of blades as Array<{ id: string; position: number }>) bladeIdToPos.set(b.id, b.position);
        for (const p of photos as Record<string, unknown>[]) {
          const pos = bladeIdToPos.get(p.blade_id as string);
          if (pos) photoBladePosMap.set(p.id as string, pos);
        }
      }
    }
  }

  // Build inspection → blade/turbine lookup
  const inspectionLookup = new Map<string, { bladePosition: number; turbineId: string; turbineName: string }>();
  for (const insp of inspections as unknown[]) {
    const row = insp as Record<string, unknown>;
    const blade = row.blade as Record<string, unknown> | null;
    const turbine = blade?.turbine as Record<string, unknown> | null;
    const directTurbine = row.direct_turbine as Record<string, unknown> | null;
    
    if (turbine) {
      // Blade-based inspection
      inspectionLookup.set(row.id as string, {
        bladePosition: Number(blade?.position) || 1,
        turbineId: turbine.id as string,
        turbineName: turbine.name as string,
      });
    } else if (directTurbine) {
      // Turbine-based inspection (covers all blades) — default to blade A
      inspectionLookup.set(row.id as string, {
        bladePosition: 1,
        turbineId: directTurbine.id as string,
        turbineName: directTurbine.name as string,
      });
    }
  }

  // 3. Aggregate annotations by turbine and blade
  const turbineMap = new Map<string, {
    id: string;
    name: string;
    blades: Map<number, { defects: Array<{ severity: number; type: string; resolved: boolean }> }>;
    allDefects: CampaignDefect[];
  }>();

  for (const a of (annotations ?? []) as unknown[]) {
    const ann = a as Record<string, unknown>;
    const lookup = inspectionLookup.get(ann.inspection_id as string);
    if (!lookup) continue;

    const { turbineId, turbineName } = lookup;
    // Determine blade position: from photo (most accurate) → from side field → from inspection lookup
    const photoBladePos = photoBladePosMap.get(ann.thumbnail_id as string);
    const sideStr = (ann.side as string) ?? '';
    const sideBladePos = sideStr === 'A' ? 1 : sideStr === 'B' ? 2 : sideStr === 'C' ? 3 : 0;
    const bladePosition = photoBladePos || sideBladePos || lookup.bladePosition;
    const severity = Number(ann.category) || 1;
    const type = normalizeAnnotationType((ann.type as string) ?? 'other');

    if (!turbineMap.has(turbineId)) {
      const newTurbine = { id: turbineId, name: turbineName, blades: new Map<number, { defects: Array<{ severity: number; type: string; resolved: boolean }> }>(), allDefects: [] as CampaignDefect[] };
      // Initialize all 3 blades
      newTurbine.blades.set(1, { defects: [] });
      newTurbine.blades.set(2, { defects: [] });
      newTurbine.blades.set(3, { defects: [] });
      turbineMap.set(turbineId, newTurbine);
    }
    const turbineData = turbineMap.get(turbineId)!;

    if (!turbineData.blades.has(bladePosition)) {
      turbineData.blades.set(bladePosition, { defects: [] });
    }
    const bladeData = turbineData.blades.get(bladePosition)!;

    bladeData.defects.push({ severity, type, resolved: false });
    const thumbId = ann.thumbnail_id as string | null;
    const photoUrl = thumbId ? photoUrlMap.get(thumbId) : undefined;
    turbineData.allDefects.push({
      id: ann.id as string,
      inspectionId: ann.inspection_id as string,
      turbineId,
      turbineName,
      bladePosition,
      type,
      severity,
      distanceFromRoot: Number(ann.y) * 43,
      widthCm: Math.round(Number(ann.w) || 0),
      heightCm: Math.round(Number(ann.h) || 0),
      side: (ann.side as string) || 'LE',
      description: (ann.note as string) || null,
      imagePaths: photoUrl ? [photoUrl] : [],
    });
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

  // Build turbineId → inspectionId map for navigation
  const turbineInspectionMap: Record<string, string> = {};
  for (const insp of inspections as unknown[]) {
    const row = insp as Record<string, unknown>;
    const lookup = inspectionLookup.get(row.id as string);
    if (lookup) {
      turbineInspectionMap[lookup.turbineId] = row.id as string;
    }
  }

  return {
    campaign,
    turbineResults,
    summary,
    totalDefects: totalDefectsCount,
    resolvedCount: totalResolvedCount,
    categoryChart,
    typeChart,
    defects: allDefects,
    turbineInspectionMap,
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
