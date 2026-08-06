import { useQuery } from '@tanstack/react-query';
import { assetsService } from '@/services/assets.service';

export function useWindFarmsDashboard() {
  return useQuery({
    queryKey: ['wind-farms-dashboard'],
    queryFn: () => assetsService.getWindFarmsDashboard(),
  });
}
