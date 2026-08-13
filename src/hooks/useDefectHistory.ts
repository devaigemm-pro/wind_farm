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
        .eq('stage', 'report')
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

      // Fetch real photos for historical defects via annotation → inspection_photo
      const imageMap: Record<string, string> = {};
      const defectsWithDesc = (defects || []).filter((d: { id: string; description: string | null }) => d.description && d.description.length === 36);
      if (defectsWithDesc.length > 0) {
        const annotationIds = defectsWithDesc.map((d: { description: string }) => d.description);
        const { data: annotations } = await supabase.from('annotation').select('id, thumbnail_id').in('id', annotationIds);
        if (annotations && annotations.length > 0) {
          const thumbnailIds = [...new Set(annotations.map((a) => a.thumbnail_id).filter(Boolean))];
          const { data: photos } = await (supabase as any).from('inspection_photo').select('id, storage_path').in('id', thumbnailIds);
          if (photos && photos.length > 0) {
            const storagePaths = photos.filter((p: any) => p.storage_path).map((p: any) => p.storage_path);
            const { data: signedResult } = await supabase.storage.from('asset-documents').createSignedUrls(storagePaths, 3600);
            const pathToUrl: Record<string, string> = {};
            if (signedResult) {
              for (const item of signedResult) {
                if (item.signedUrl && !item.error) {
                  pathToUrl[item.path ?? ''] = item.signedUrl;
                }
              }
            }
            const photoUrlMap: Record<string, string> = {};
            for (const photo of photos) {
              if (photo.storage_path && pathToUrl[photo.storage_path]) {
                photoUrlMap[photo.id] = pathToUrl[photo.storage_path]!;
              }
            }
            const annPhotoMap: Record<string, string> = {};
            for (const ann of annotations) {
              if (ann.thumbnail_id && photoUrlMap[ann.thumbnail_id]) {
                annPhotoMap[ann.id] = photoUrlMap[ann.thumbnail_id]!;
              }
            }
            for (const d of defectsWithDesc) {
              if (d.description && annPhotoMap[d.description]) {
                imageMap[d.id] = annPhotoMap[d.description]!;
              }
            }
          }
        }
      }

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
            imageUrl: imageMap[d.id] || '',
          };
        }
      );

      return { inspections: historicalInspections, defects: historicalDefects };
    },
    enabled: !!bladeId && !!currentInspectionId,
  });
}
