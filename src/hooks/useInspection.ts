import { useQuery } from '@tanstack/react-query';
import { inspectionsService } from '@/services/inspections.service';

export function useInspection(id: string) {
  return useQuery({
    queryKey: ['inspection', id],
    queryFn: () => inspectionsService.getInspection(id),
    enabled: !!id,
  });
}
