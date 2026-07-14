import { useQuery } from '@tanstack/react-query';
import { historyService, type BladeHistoryFilters } from '@/services/history.service';

export function useBladeHistory(bladeId: string | undefined, filters?: BladeHistoryFilters) {
  return useQuery({
    queryKey: ['bladeHistory', bladeId, filters],
    queryFn: () => historyService.getBladeHistory(bladeId!, filters),
    enabled: !!bladeId,
  });
}
