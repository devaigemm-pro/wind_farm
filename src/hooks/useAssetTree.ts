import { useQuery } from '@tanstack/react-query';
import { assetsService } from '@/services/assets.service';

export function useAssetTree() {
  return useQuery({
    queryKey: ['asset-tree'],
    queryFn: () => assetsService.getAssetTree(),
  });
}
