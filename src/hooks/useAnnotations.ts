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
  // Stabilize the query key by sorting and joining IDs into a single string.
  // This prevents cache misses when the same IDs arrive in a different order.
  const stableKey = inspectionIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['annotations-multi', stableKey],
    queryFn: () => annotationsService.listMultiple(inspectionIds),
    enabled: inspectionIds.length > 0,
    // Always refetch when the component mounts (e.g. navigating back from step 2 to step 4)
    // to pick up annotations created while this component was unmounted.
    staleTime: 0,
    refetchOnMount: 'always',
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
      queryClient.invalidateQueries({ queryKey: ['campaign-annotations'] });
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
      queryClient.invalidateQueries({ queryKey: ['campaign-annotations'] });
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
      queryClient.invalidateQueries({ queryKey: ['campaign-annotations'] });
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
    staleTime: 30 * 60 * 1000, // 30 min — campaign inspections rarely change
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Combined hook that fetches annotations for all inspections in a campaign.
 * Uses a single RPC-style approach: first gets inspection IDs (fast, cached),
 * then fetches annotations. Both steps are parallelized with the photos query
 * since they share the same campaignId dependency (no waterfall).
 */
export function useCampaignAnnotations(campaignId: string | null, fallbackInspectionId?: string) {
  // Step 1: get inspection IDs for the campaign (fast, small payload)
  const { data: inspIds = [] } = useCampaignInspectionIds(campaignId);

  // Determine which IDs to fetch annotations for
  const effectiveIds = inspIds.length > 0 ? inspIds : (fallbackInspectionId ? [fallbackInspectionId] : []);
  const stableKey = effectiveIds.slice().sort().join(',');

  return useQuery({
    queryKey: ['campaign-annotations', stableKey],
    queryFn: () => annotationsService.listMultiple(effectiveIds),
    enabled: effectiveIds.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * FAST: Loads photo_id → blade_id mapping only (no signed URLs).
 * This unblocks defect rendering on blades immediately.
 */
export function usePhotoBladeMap(campaignId: string | null) {
  return useQuery({
    queryKey: ['photo-blade-map', campaignId],
    queryFn: async () => {
      if (!campaignId) return {};
      const { supabase } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db
        .from('inspection_photo')
        .select('id, blade_id')
        .eq('campaign_id', campaignId);
      if (error || !data) return {};

      const map: Record<string, string> = {};
      for (const row of data) {
        map[row.id] = row.blade_id;
      }
      return map;
    },
    enabled: !!campaignId,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * LAZY: Generates signed thumbnail URLs only for photos that have annotations.
 * Takes the thumbnailIds from loaded annotations to minimize requests.
 */
export function useAnnotationThumbnailUrls(thumbnailIds: string[], campaignId: string | null) {
  const stableKey = thumbnailIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['annotation-thumb-urls', stableKey],
    queryFn: async () => {
      if (thumbnailIds.length === 0 || !campaignId) return {};
      const { supabase } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      // Get storage_path only for the annotation thumbnails
      const { data, error } = await db
        .from('inspection_photo')
        .select('id, storage_path')
        .in('id', thumbnailIds);
      if (error || !data) return {};

      // Generate signed URLs for thumbnails only
      const importedRows = data.filter((r: any) => r.storage_path?.startsWith('inspection-imports/'));
      const urlMap: Record<string, string> = {};

      if (importedRows.length > 0) {
        const thumbPaths = importedRows.map((r: any) => {
          const lastSlash = r.storage_path.lastIndexOf('/');
          const dir = r.storage_path.substring(0, lastSlash);
          const filename = r.storage_path.substring(lastSlash + 1);
          return `${dir}/thumb_${filename}`;
        });

        try {
          const { data: signedData } = await supabase.storage
            .from('asset-documents')
            .createSignedUrls(thumbPaths, 3600);
          if (signedData) {
            for (let j = 0; j < signedData.length; j++) {
              const item = signedData[j];
              if (item?.signedUrl && !item.error) {
                urlMap[importedRows[j].id] = item.signedUrl;
              }
            }
          }
        } catch {
          // Silent fallback
        }
      }

      return urlMap;
    },
    enabled: thumbnailIds.length > 0 && !!campaignId,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Generates viewer-quality URLs (1400px, 82% quality) for annotation photos.
 * Used by the RESULTS screen to show high-resolution defect images.
 * Uses the same getPhotoPublicUrl approach as AnnotateStep for consistent quality.
 */
export function useAnnotationViewerUrls(thumbnailIds: string[], campaignId: string | null) {
  const stableKey = thumbnailIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['annotation-viewer-urls', stableKey],
    queryFn: async () => {
      if (thumbnailIds.length === 0 || !campaignId) return {};
      const { supabase } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      // Get storage_path for the annotation photos
      const { data, error } = await db
        .from('inspection_photo')
        .select('id, storage_path')
        .in('id', thumbnailIds);
      if (error || !data) return {};

      const { getPhotoPublicUrl } = await import('@/hooks/useInspectionPhotos');

      const urlMap: Record<string, string> = {};

      // For imported photos that need signed URLs (private bucket)
      const importedRows = data.filter((r: any) => r.storage_path?.startsWith('inspection-imports/'));

      if (importedRows.length > 0) {
        // Generate signed URLs for the ORIGINAL files (not thumb_ prefixed)
        const originalPaths = importedRows.map((r: any) => r.storage_path);
        const BATCH_SIZE = 50;

        for (let i = 0; i < originalPaths.length; i += BATCH_SIZE) {
          const batch = originalPaths.slice(i, i + BATCH_SIZE);
          const batchRows = importedRows.slice(i, i + BATCH_SIZE);

          try {
            const { data: signedData } = await supabase.storage
              .from('asset-documents')
              .createSignedUrls(batch, 3600);
            if (signedData) {
              for (let j = 0; j < signedData.length; j++) {
                const item = signedData[j];
                if (item?.signedUrl && !item.error) {
                  // Same approach as getPhotoPublicUrl: append width/quality params to signed URL
                  const separator = item.signedUrl.includes('?') ? '&' : '?';
                  urlMap[batchRows[j].id] = `${item.signedUrl}${separator}width=1400&quality=82`;
                }
              }
            }
          } catch {
            // Fallback: use getPhotoPublicUrl for each
            for (const row of batchRows) {
              urlMap[row.id] = getPhotoPublicUrl(row.storage_path, 'viewer');
            }
          }
        }
      }

      // For non-imported photos, use getPhotoPublicUrl with 'viewer' size
      const otherRows = data.filter((r: any) => !r.storage_path?.startsWith('inspection-imports/'));
      for (const row of otherRows) {
        if (row.storage_path) {
          urlMap[row.id] = getPhotoPublicUrl(row.storage_path, 'viewer');
        }
      }

      return urlMap;
    },
    enabled: thumbnailIds.length > 0 && !!campaignId,
    staleTime: 30 * 60 * 1000,
  });
}
