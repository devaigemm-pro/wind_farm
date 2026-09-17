import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assetsService } from '@/services/assets.service';
import type { WindFarm } from '@/types';

const ASSET_TREE_KEY = ['asset-tree'] as const;

/** Full wind farm → turbine → blade tree for the admin maintainer. */
export function useAssetTree() {
  return useQuery<WindFarm[]>({
    queryKey: ASSET_TREE_KEY,
    queryFn: () => assetsService.getAssetTree(),
  });
}

// ─── Wind Farm mutations ──────────────────────────────────────────────────────

export function useCreateWindFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof assetsService.createWindFarm>[0]) =>
      assetsService.createWindFarm(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_TREE_KEY });
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
      input: Parameters<typeof assetsService.updateWindFarm>[1];
    }) => assetsService.updateWindFarm(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_TREE_KEY });
    },
  });
}

export function useDeleteWindFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assetsService.deleteWindFarm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_TREE_KEY });
    },
  });
}

// ─── Turbine mutations ────────────────────────────────────────────────────────

export function useCreateTurbine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof assetsService.createTurbine>[0]) =>
      assetsService.createTurbine(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_TREE_KEY });
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
      input: Parameters<typeof assetsService.updateTurbine>[1];
    }) => assetsService.updateTurbine(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_TREE_KEY });
    },
  });
}

export function useDeleteTurbine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assetsService.deleteTurbine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_TREE_KEY });
    },
  });
}

// ─── Blade mutations ──────────────────────────────────────────────────────────

export function useUpdateBlade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Parameters<typeof assetsService.updateBlade>[1];
    }) => assetsService.updateBlade(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_TREE_KEY });
    },
  });
}
