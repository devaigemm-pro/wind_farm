import { useQuery } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';

export function useDefects(inspectionId: string) {
  return useQuery({
    queryKey: ['defects', inspectionId],
    queryFn: () => defectsService.listDefects(inspectionId),
    enabled: !!inspectionId,
  });
}
