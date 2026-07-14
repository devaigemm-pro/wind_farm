import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsService } from '@/services/assets.service';

export function useTurbines(windFarmId: string) {
  return useQuery({
    queryKey: ['turbines', windFarmId],
    queryFn: () => assetsService.getTurbines(windFarmId),
    enabled: !!windFarmId,
  });
}

export function useCreateTurbine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { wind_farm_id: string; name: string; model?: string }) =>
      assetsService.createTurbine(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['turbines', variables.wind_farm_id] });
      queryClient.invalidateQueries({ queryKey: ['asset-tree'] });
    },
  });
}

export function useUpdateTurbine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<{ name: string; model: string | null; wind_farm_id: string }>;
    }) => assetsService.updateTurbine(id, input),
    onSuccess: (_data, variables) => {
      // Invalidate all turbine lists since wind_farm_id might have changed
      queryClient.invalidateQueries({ queryKey: ['turbines'] });
      if (variables.input.wind_farm_id) {
        queryClient.invalidateQueries({ queryKey: ['turbines', variables.input.wind_farm_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['asset-tree'] });
    },
  });
}

export function useDeleteTurbine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assetsService.deleteTurbine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turbines'] });
      queryClient.invalidateQueries({ queryKey: ['asset-tree'] });
    },
  });
}
