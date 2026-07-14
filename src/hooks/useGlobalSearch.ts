import { useQuery } from '@tanstack/react-query';
import { historyService } from '@/services/history.service';

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ['globalSearch', query],
    queryFn: () => historyService.globalSearch(query),
    enabled: query.trim().length >= 2,
    placeholderData: { assets: [], inspections: [] },
  });
}
