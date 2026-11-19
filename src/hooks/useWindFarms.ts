import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsService } from '@/services/assets.service';

export function useWindFarms() {
  return useQuery({
    queryKey: ['wind-farms'],
    queryFn: () => assetsService.getWindFarms(),
  });
}

export function useWindFarm(id: string) {
  return useQuery({
    queryKey: ['wind-farm', id],
    queryFn: () => assetsService.getWindFarm(id),
    enabled: !!id,
  });
}

export function useCreateWindFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; location: string; country?: string; client?: string; latitude?: number; longitude?: number; manager_name?: string }) =>
      assetsService.createWindFarm(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wind-farms'] });
      queryClient.invalidateQueries({ queryKey: ['asset-tree'] });
    },
  });
}

export function useUpdateWindFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<{ name: string; location: string; country: string | null; client: string | null; latitude: number | null; longitude: number | null; manager_name: string | null }>;
    }) => assetsService.updateWindFarm(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wind-farms'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farm', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['asset-tree'] });
    },
  });
}

/** What deleting a wind farm would remove (dry run). Never cached: it must reflect the data NOW. */
export function useWindFarmDeletionPreview(id: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['wind-farm-deletion-preview', id],
    queryFn: () => assetsService.previewWindFarmDeletion(id!),
    enabled: enabled && !!id,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useDeleteWindFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assetsService.deleteWindFarm(id),
    onSuccess: () => {
      // The farm and everything under it is gone: refresh every list that showed it.
      for (const key of [
        'wind-farms',
        'wind-farm',
        'asset-tree',
        'wind-farms-dashboard',
        'campaigns',
        'turbines',
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
