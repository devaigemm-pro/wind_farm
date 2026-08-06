import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { annotationsService, type Annotation, type CreateAnnotationInput, type UpdateAnnotationInput } from '@/services/annotations.service';

export function useAnnotations(inspectionId: string) {
  return useQuery({
    queryKey: ['annotations', inspectionId],
    queryFn: () => annotationsService.list(inspectionId),
    enabled: !!inspectionId,
  });
}

export function useMultiAnnotations(inspectionIds: string[]) {
  return useQuery({
    queryKey: ['annotations-multi', ...inspectionIds],
    queryFn: () => annotationsService.listMultiple(inspectionIds),
    enabled: inspectionIds.length > 0,
  });
}

export function useCreateAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnotationInput) => annotationsService.create(input),
    onMutate: async (input) => {
      // Cancel any outgoing re-fetches
      await queryClient.cancelQueries({ queryKey: ['annotations-multi'] });
      await queryClient.cancelQueries({ queryKey: ['annotations', input.inspectionId] });

      // Snapshot previous value (find the matching multi-annotations cache)
      const cacheKeys = queryClient
        .getQueriesData<Annotation[]>({ queryKey: ['annotations-multi'] });

      // Optimistically add the new annotation to every matching cache
      const tempId = `temp-${Date.now()}`;
      const optimisticAnnotation: Annotation = {
        id: tempId,
        inspectionId: input.inspectionId,
        thumbnailId: input.thumbnailId,
        x: input.x,
        y: input.y,
        w: input.w,
        h: input.h,
        angle: input.angle ?? 0,
        type: input.type,
        category: input.category,
        note: input.note ?? '',
        rootCause: input.rootCause ?? '',
        nextStep: input.nextStep ?? '',
        side: null,
        createdAt: new Date().toISOString(),
      };

      for (const [key] of cacheKeys) {
        queryClient.setQueryData<Annotation[]>(key, (old) =>
          old ? [...old, optimisticAnnotation] : [optimisticAnnotation],
        );
      }

      return { cacheKeys, tempId };
    },
    onSuccess: (_data, variables) => {
      // Refresh from server to get real IDs
      queryClient.invalidateQueries({ queryKey: ['annotations', variables.inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['annotations-multi'] });
    },
    onError: (_err, _variables, context) => {
      // Rollback optimistic updates
      if (context?.cacheKeys) {
        for (const [key, previousData] of context.cacheKeys) {
          queryClient.setQueryData(key, previousData);
        }
      }
    },
  });
}

export function useUpdateAnnotation(inspectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateAnnotationInput) =>
      annotationsService.update(id, data),
    // Optimistic update for instant UI response
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['annotations', inspectionId] });
      const previous = queryClient.getQueryData<Annotation[]>(['annotations', inspectionId]);
      queryClient.setQueryData<Annotation[]>(['annotations', inspectionId], (old) =>
        (old || []).map((a) => (a.id === id ? { ...a, ...data } : a)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['annotations', inspectionId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['annotations-multi'] });
    },
  });
}

export function useDeleteAnnotation(inspectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => annotationsService.remove(id),
    // Optimistic delete
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['annotations', inspectionId] });
      const previous = queryClient.getQueryData<Annotation[]>(['annotations', inspectionId]);
      queryClient.setQueryData<Annotation[]>(['annotations', inspectionId], (old) =>
        (old || []).filter((a) => a.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['annotations', inspectionId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['annotations-multi'] });
    },
  });
}

export function useCampaignInspectionIds(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-inspection-ids', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await (await import('@/lib/supabase')).supabase
        .from('inspection')
        .select('id')
        .eq('campaign_id', campaignId);
      if (error || !data) return [];
      return data.map((row: { id: string }) => row.id);
    },
    enabled: !!campaignId,
  });
}
