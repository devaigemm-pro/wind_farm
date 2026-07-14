import { useMutation, useQueryClient } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';
import type { DefectType, Severity } from '@/types';

export function useCreateDefect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      inspection_id: string;
      type: DefectType;
      severity: Severity;
      distance_from_root: number;
      description?: string;
    }) => defectsService.createDefect(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['defects', variables.inspection_id] });
    },
  });
}

export function useUpdateDefect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<{
        type: DefectType;
        severity: Severity;
        distance_from_root: number;
        description: string | null;
      }>;
    }) => defectsService.updateDefect(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
    },
  });
}

export function useDeleteDefect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => defectsService.deleteDefect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
    },
  });
}
