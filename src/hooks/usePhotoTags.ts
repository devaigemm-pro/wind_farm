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
      // First read current metadata to merge
      const { data: current, error: readErr } = await db
        .from('inspection_photo')
        .select('metadata')
        .eq('id', photoId)
        .single();

      if (readErr) throw readErr;

      const currentMeta = (current?.metadata as Record<string, unknown>) || {};
      const updatedMeta = { ...currentMeta, tagged: isTagged };

      const { error } = await db
        .from('inspection_photo')
        .update({ metadata: updatedMeta })
        .eq('id', photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-photos'] });
    },
  });
}

/**
 * Mark a photo as viewed in metadata. Only writes if not already viewed.
 */
export function useMarkPhotoViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId }: { photoId: string }) => {
      // Read current metadata
      const { data: current, error: readErr } = await db
        .from('inspection_photo')
        .select('metadata')
        .eq('id', photoId)
        .single();

      if (readErr) throw readErr;

      const currentMeta = (current?.metadata as Record<string, unknown>) || {};

      // Skip if already viewed
      if (currentMeta.viewed === true) return;

      const updatedMeta = { ...currentMeta, viewed: true };

      const { error } = await db
        .from('inspection_photo')
        .update({ metadata: updatedMeta })
        .eq('id', photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-photos'] });
    },
  });
}
