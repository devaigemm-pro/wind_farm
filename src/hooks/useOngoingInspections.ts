import { useQuery } from '@tanstack/react-query';
import { ongoingService } from '@/services/ongoing.service';

export function useOngoingInspections() {
  return useQuery({
    queryKey: ['ongoing-inspections'],
    queryFn: () => ongoingService.getOngoingInspections(),
  });
}
