import { useMutation, useQueryClient } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';
import type { DefectDashboardRow } from '@/types';

export function useDefectResolvedToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      // Toggle resolved via RPC (SECURITY DEFINER, bypasses RLS)
      await defectsService.toggleDefectResolved(id, resolved);
      // Add "Defect closed" comment when marking as resolved
      if (resolved) {
        await defectsService.addDefectComment(id, 'Defect closed');
      } else {
        await defectsService.deleteDefectCommentByText(id, 'Defect closed').catch(() => {});
      }
    },
    // Optimistic update: immediately flip resolved in the local cache
    onMutate: async ({ id, resolved }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['defects-dashboard'] });

      // Snapshot previous value for rollback
      const previousQueries = queryClient.getQueriesData<{ data: DefectDashboardRow[]; totalCount: number }>({
        queryKey: ['defects-dashboard'],
      });

      // Optimistically update all matching queries
      queryClient.setQueriesData<{ data: DefectDashboardRow[]; totalCount: number }>(
        { queryKey: ['defects-dashboard'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((d) => (d.id === id ? { ...d, resolved } : d)),
          };
        },
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      // Rollback all queries to previous state
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          if (data) queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: (_, { id }) => {
      // Only invalidate comments (lightweight), NOT the full defects dashboard
      queryClient.invalidateQueries({ queryKey: ['defect-comments', id] });
    },
    // Do NOT invalidate defects-dashboard on settle — trust the optimistic update
    // The RPC will be re-called naturally when the user navigates or changes page/sort/search
  });
}
