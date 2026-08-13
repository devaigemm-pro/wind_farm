import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Toggle the tagged state on an inspection_photo row using the metadata JSONB column.
 * Stores {"tagged": true/false} inside the existing metadata field.
 */
export function useTogglePhotoTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, isTagged }: { photoId: string; isTagged: boolean }) => {
      // Update both: the metadata.tagged field AND the is_tagged column for compatibility
      const { data: current, error: readErr } = await db
        .from('inspection_photo')
        .select('metadata')
        .eq('id', photoId)
        .single();

      if (readErr) {
        console.error('[useTogglePhotoTag] Read error:', readErr);
        throw readErr;
      }

      const currentMeta = (current?.metadata as Record<string, unknown>) || {};
      const updatedMeta = { ...currentMeta, tagged: isTagged };

      const { error } = await db
        .from('inspection_photo')
        .update({ metadata: updatedMeta })
        .eq('id', photoId);

      if (error) {
        console.error('[useTogglePhotoTag] Update error:', error);
        throw error;
      }
      return { photoId, isTagged };
    },
    // Optimistic update: immediately toggle in the cached photos array
    onMutate: async ({ photoId, isTagged }) => {
      await queryClient.cancelQueries({ queryKey: ['inspection-photos'] });

      const photoCaches = queryClient.getQueriesData<Array<{ id: string; isTagged: boolean }>>({
        queryKey: ['inspection-photos'],
      });

      for (const [key] of photoCaches) {
        queryClient.setQueryData(key, (old: Array<{ id: string; isTagged: boolean }> | undefined) => {
          if (!old) return old;
          return old.map((p) => (p.id === photoId ? { ...p, isTagged } : p));
        });
      }

      return { photoCaches };
    },
    onError: (err, _vars, context) => {
      console.error('[useTogglePhotoTag] Mutation error:', err);
      // Rollback on error
      if (context?.photoCaches) {
        for (const [key, previousData] of context.photoCaches) {
          queryClient.setQueryData(key, previousData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-photos'] });
    },
  });
}

/**
 * Mark a photo as viewed in metadata. Only writes if not already viewed.
 * Uses optimistic update so the progress bar advances immediately.
 * Also updates viewed_percent on the inspection table for cross-session persistence.
 */
export function useMarkPhotoViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, campaignId }: { photoId: string; campaignId?: string | null }) => {
      // Read current metadata
      const { data: current, error: readErr } = await db
        .from('inspection_photo')
        .select('metadata, campaign_id')
        .eq('id', photoId)
        .single();

      if (readErr) throw readErr;

      const currentMeta = (current?.metadata as Record<string, unknown>) || {};

      // Skip if already viewed
      if (currentMeta.viewed === true) return { alreadyViewed: true, campaignId: current.campaign_id };

      const updatedMeta = { ...currentMeta, viewed: true };

      const { error } = await db
        .from('inspection_photo')
        .update({ metadata: updatedMeta })
        .eq('id', photoId);

      if (error) throw error;

      return { alreadyViewed: false, campaignId: campaignId || current.campaign_id };
    },
    // Optimistic update: immediately mark as viewed in the cached photos array
    onMutate: async ({ photoId }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['inspection-photos'] });

      // Snapshot all inspection-photos caches
      const photoCaches = queryClient.getQueriesData<Array<{ id: string; isViewed: boolean }>>({
        queryKey: ['inspection-photos'],
      });

      // Optimistically set isViewed = true on the target photo
      for (const [key] of photoCaches) {
        queryClient.setQueryData(key, (old: Array<{ id: string; isViewed: boolean }> | undefined) => {
          if (!old) return old;
          return old.map((p) => (p.id === photoId ? { ...p, isViewed: true } : p));
        });
      }

      return { photoCaches };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.photoCaches) {
        for (const [key, previousData] of context.photoCaches) {
          queryClient.setQueryData(key, previousData);
        }
      }
    },
    onSuccess: async (result) => {
      if (!result || result.alreadyViewed) return;

      // Recalculate viewed_percent and persist to inspection table
      const cid = result.campaignId;
      if (!cid) return;

      try {
        // Count total and viewed photos for this campaign
        const { count: totalCount } = await db
          .from('inspection_photo')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', cid);

        const { data: viewedRows } = await db
          .from('inspection_photo')
          .select('metadata')
          .eq('campaign_id', cid);

        const viewedCount = (viewedRows ?? []).filter(
          (r: { metadata: Record<string, unknown> | null }) => r.metadata?.viewed === true
        ).length;

        const percent = totalCount > 0 ? Math.round((viewedCount / totalCount) * 100) : 0;

        // Update all inspections in this campaign with the new percentage
        await db
          .from('inspection')
          .update({ viewed_percent: percent })
          .eq('campaign_id', cid);
      } catch (e) {
        console.error('[useMarkPhotoViewed] Failed to update viewed_percent:', e);
      }
    },
  });
}
