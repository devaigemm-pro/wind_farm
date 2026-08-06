import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface HistoricalInspection {
  id: string;
  date: string;
  label: string;
}

export interface HistoricalDefect {
  id: string;
  type: string;
  severity: number;
  distanceFromRoot: number;
  widthCm: number;
  heightCm: number;
  side: string;
  description: string | null;
  inspectionId: string;
  inspectionDate: string;
  imageUrl: string;
}

const TYPE_IMAGE_MAP: Record<string, string> = {
  le_erosion: '/test-images/defect-erosion-close-prev.svg',
  vortex: '/test-images/defect-vortex-close-prev.svg',
  paint_defect: '/test-images/defect-paint-close-prev.svg',
  crack: '/test-images/defect-crack-close-prev.svg',
  delamination: '/test-images/defect-delamination-close-prev.svg',
  lightning_damage: '/test-images/defect-crack-close-prev.svg',
  other: '/test-images/defect-blade-close.svg',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useDefectHistory(
  bladeId: string | undefined,
  distanceFromRoot: number,
  currentInspectionId: string | undefined
) {
  return useQuery({
    queryKey: ['defect-history', bladeId, distanceFromRoot, currentInspectionId],
    queryFn: async () => {
      if (!bladeId) return { inspections: [], defects: [] };

      // Get all finalized inspections for this blade except current
      const { data: inspections } = await db
        .from('inspection')
        .select('id, completed_at, scheduled_date')
        .eq('blade_id', bladeId)
        .eq('stage', 'finalized')
        .neq('id', currentInspectionId || '')
        .order('completed_at', { ascending: false });

      if (!inspections || inspections.length === 0)
        return { inspections: [], defects: [] };

      const inspIds = inspections.map((i: { id: string }) => i.id);

      // Get defects at similar position (± 5m)
      const { data: defects } = await db
        .from('defect')
        .select(
          'id, type, severity, distance_from_root, width_cm, height_cm, side, description, inspection_id'
        )
        .in('inspection_id', inspIds)
        .gte('distance_from_root', distanceFromRoot - 5)
        .lte('distance_from_root', distanceFromRoot + 5);

      const historicalInspections: HistoricalInspection[] = inspections.map(
        (i: { id: string; completed_at: string | null; scheduled_date: string }) => ({
          id: i.id,
          date: i.completed_at || i.scheduled_date,
          label: new Date(i.completed_at || i.scheduled_date).toLocaleString(),
        })
      );

      const historicalDefects: HistoricalDefect[] = (defects || []).map(
        (d: {
          id: string;
          type: string;
          severity: number;
          distance_from_root: number;
          width_cm: number | null;
          height_cm: number | null;
          side: string | null;
          description: string | null;
          inspection_id: string;
        }) => {
          const insp = inspections.find(
            (i: { id: string; completed_at: string | null; scheduled_date: string }) =>
              i.id === d.inspection_id
          );
          return {
            id: d.id,
            type: d.type,
            severity: d.severity,
            distanceFromRoot: d.distance_from_root,
            widthCm: d.width_cm || 0,
            heightCm: d.height_cm || 0,
            side: d.side || 'LE',
            description: d.description,
            inspectionId: d.inspection_id,
            inspectionDate: insp?.completed_at || insp?.scheduled_date || '',
            imageUrl: TYPE_IMAGE_MAP[d.type] || '/test-images/defect-blade-close.svg',
          };
        }
      );

      return { inspections: historicalInspections, defects: historicalDefects };
    },
    enabled: !!bladeId && !!currentInspectionId,
  });
}
