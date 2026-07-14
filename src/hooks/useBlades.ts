import { useQuery } from '@tanstack/react-query';
import { assetsService } from '@/services/assets.service';

export function useBlades(turbineId: string) {
  return useQuery({
    queryKey: ['blades', turbineId],
    queryFn: () => assetsService.getBlades(turbineId),
    enabled: !!turbineId,
  });
}
