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
    mutationFn: (input: { name: string; location: string; latitude?: number; longitude?: number }) =>
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
      input: Partial<{ name: string; location: string; latitude: number | null; longitude: number | null }>;
    }) => assetsService.updateWindFarm(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wind-farms'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farm', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['asset-tree'] });
    },
  });
}

export function useDeleteWindFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assetsService.deleteWindFarm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wind-farms'] });
      queryClient.invalidateQueries({ queryKey: ['asset-tree'] });
    },
  });
}
