import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface TurbineDefect {
  id: string;
  displayId: string;
  type: string;
  cat: number;
  blade: string;
  side: string;
  root: number;
  size: string;
  description: string | null;
  resolved: boolean;
  images: string[];
  notes: string | null;
  rootCause: string | null;
  nextStep: string | null;
  comments?: { author: string; date: string; text: string }[];
}

export interface TurbineInspectionData {
  inspectionId: string;
  inspectionIds: string[];
  inspectionToBladePosition: Record<string, string>;
  inspectionDate: string;
  windFarmName: string;
  windFarmId: string;
  turbineName: string;
  turbineId: string;
  blades: { position: string; serialNumber: string; id: string }[];
  defects: TurbineDefect[];
  bladeLength: number;
  windFarmCoords: { lat: number; lon: number } | null;
}

/**
 * Fetches the latest finalized inspection for a turbine with all defects and blade info.
 * Falls back to null if no finalized inspection exists (component will use mock data).
 */
async function fetchTurbineInspection(turbineId: string): Promise<TurbineInspectionData | null> {
  // Get turbine info with wind farm
  const { data: turbine, error: turbErr } = await supabase
    .from('turbine')
    .select(`
      id, name,
      wind_farm:wind_farm_id (id, name, latitude, longitude)
    `)
    .eq('id', turbineId)
    .single();

  if (turbErr || !turbine) return null;

  // Get blades for this turbine
  const { data: blades, error: bladeErr } = await supabase
    .from('blade')
    .select('id, position, serial_number, length_meters')
    .eq('turbine_id', turbineId)
    .order('position');

  if (bladeErr || !blades || blades.length === 0) return null;

  const bladeIds = blades.map((b) => b.id);

  // Get the latest finalized inspection for any blade of this turbine
  const { data: inspections, error: inspErr } = await supabase
    .from('inspection')
    .select('id, completed_at, scheduled_date, stage')
    .in('blade_id', bladeIds)
    .eq('stage', 'finalized')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (inspErr || !inspections || inspections.length === 0) return null;

  const inspection = inspections[0]!;

  // Get ALL finalized inspections for this turbine's blades to get all defects
  const { data: allInspections, error: allInspErr } = await supabase
    .from('inspection')
    .select('id, blade_id')
    .in('blade_id', bladeIds)
    .eq('stage', 'finalized');

  if (allInspErr || !allInspections) return null;

  const inspectionIds = allInspections.map((i) => i.id);

  // Map inspection_id to blade_id
  const inspToBlade: Record<string, string> = {};
  for (const insp of allInspections) {
    inspToBlade[insp.id] = insp.blade_id;
  }

  // Get defects for all finalized inspections of this turbine
  const { data: defects, error: defErr } = await supabase
    .from('defect')
    .select('id, type, severity, distance_from_root, description, inspection_id')
    .in('inspection_id', inspectionIds)
    .order('distance_from_root');

  if (defErr) return null;

  // Get images linked to defects
  const defectIds = (defects || []).map((d) => d.id);
  const defectImages: Record<string, string[]> = {};

  if (defectIds.length > 0) {
    const { data: imgLinks } = await supabase
      .from('defect_image')
      .select('defect_id, evidence_id')
      .in('defect_id', defectIds);

    if (imgLinks && imgLinks.length > 0) {
      const evidenceIds = imgLinks.map((l) => l.evidence_id);
      const { data: evidenceFiles } = await supabase
        .from('evidence')
        .select('id, storage_path')
        .in('id', evidenceIds);

      const evidencePathMap: Record<string, string> = {};
      for (const e of evidenceFiles || []) {
        evidencePathMap[e.id] = e.storage_path;
      }

      for (const link of imgLinks) {
        const path = evidencePathMap[link.evidence_id];
        if (path) {
          if (!defectImages[link.defect_id]) defectImages[link.defect_id] = [];
          defectImages[link.defect_id]!.push(path);
        }
      }
    }
  }



  // Map blade position to letter
  const positionToLetter: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };
  const bladeIdToPosition: Record<string, string> = {};
  for (const b of blades) {
    bladeIdToPosition[b.id] = positionToLetter[b.position] || String(b.position);
  }

  // Build defect display IDs (A1, A2, B1, etc.)
  const bladeDefectCounters: Record<string, number> = {};
  const mappedDefects: TurbineDefect[] = (defects || []).map((d) => {
    const bladeId = inspToBlade[d.inspection_id] ?? '';
    const bladeLetter = bladeIdToPosition[bladeId] || '?';
    bladeDefectCounters[bladeLetter] = (bladeDefectCounters[bladeLetter] || 0) + 1;
    const displayId = `${bladeLetter}${bladeDefectCounters[bladeLetter]}`;

    return {
      id: d.id,
      displayId,
      type: formatDefectType(d.type),
      cat: d.severity,
      blade: bladeLetter,
      side: 'LE', // Default — schema doesn't have side field
      root: d.distance_from_root,
      size: '-', // Schema doesn't have size field
      description: d.description,
      resolved: false,
      images: defectImages[d.id] || [],
      notes: d.description,
      rootCause: null,
      nextStep: null,
    };
  });

  const wf = turbine.wind_farm as any;
  // Build inspectionId → blade position letter mapping
  const inspectionToBladePosition: Record<string, string> = {};
  for (const insp of allInspections) {
    inspectionToBladePosition[insp.id] = bladeIdToPosition[insp.blade_id] || '?';
  }

  const maxBladeLength = blades.reduce((max, b) => Math.max(max, b.length_meters || 43), 0);

  return {
    inspectionId: inspection.id,
    inspectionIds: inspectionIds,
    inspectionToBladePosition,
    inspectionDate: inspection.completed_at || inspection.scheduled_date,
    windFarmName: wf?.name || 'Unknown',
    windFarmId: wf?.id || '',
    turbineName: turbine.name,
    turbineId: turbine.id,
    blades: blades.map((b) => ({
      position: positionToLetter[b.position] || String(b.position),
      serialNumber: b.serial_number || 'N/A',
      id: b.id,
    })),
    defects: mappedDefects,
    bladeLength: maxBladeLength,
    windFarmCoords: wf?.latitude && wf?.longitude ? { lat: wf.latitude, lon: wf.longitude } : null,
  };
}

function formatDefectType(type: string): string {
  const labels: Record<string, string> = {
    le_erosion: 'LE EROSION',
    vortex: 'VORTEX (MISSING PANELS)',
    paint_defect: 'PAINT DAMAGES',
    crack: 'CRACK',
    delamination: 'DELAMINATION',
    lightning_damage: 'LIGHTNING DAMAGE',
    other: 'OTHER ADD-ONS MISSING',
  };
  return labels[type] || type.toUpperCase().replace(/_/g, ' ');
}

export function useTurbineInspection(turbineId: string) {
  return useQuery({
    queryKey: ['turbine-inspection', turbineId],
    queryFn: () => fetchTurbineInspection(turbineId),
    enabled: !!turbineId,
  });
}
