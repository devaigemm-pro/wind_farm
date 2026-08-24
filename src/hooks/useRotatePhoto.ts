import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Rotate a photo 90° clockwise. Persists the rotation in metadata JSONB.
 * Uses optimistic update so the rotation applies immediately in the viewer.
 */
export function useRotatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, currentRotation }: { photoId: string; currentRotation: number }) => {
      const newRotation = (currentRotation + 90) % 360;

      // Read current metadata
      const { data: current, error: readErr } = await db
        .from('inspection_photo')
        .select('metadata')
        .eq('id', photoId)
        .single();

      if (readErr) throw readErr;

      const currentMeta = (current?.metadata as Record<string, unknown>) || {};
      const updatedMeta = { ...currentMeta, rotation: newRotation };

      const { error } = await db
        .from('inspection_photo')
        .update({ metadata: updatedMeta })
        .eq('id', photoId);

      if (error) {
        console.error('[useRotatePhoto] Update error:', error);
        throw error;
      }

      return { photoId, newRotation };
    },
    // Optimistic update: immediately rotate in the cached photos array
    onMutate: async ({ photoId, currentRotation }) => {
      const newRotation = (currentRotation + 90) % 360;

      await queryClient.cancelQueries({ queryKey: ['inspection-photos'] });

      const photoCaches = queryClient.getQueriesData<Array<{ id: string; rotation: number }>>({
        queryKey: ['inspection-photos'],
      });

      for (const [key] of photoCaches) {
        queryClient.setQueryData(key, (old: Array<{ id: string; rotation: number }> | undefined) => {
          if (!old) return old;
          return old.map((p) => (p.id === photoId ? { ...p, rotation: newRotation } : p));
        });
      }

      return { photoCaches };
    },
    onError: (err, _vars, context) => {
      console.error('[useRotatePhoto] Mutation error:', err);
      // Rollback on error
      if (context?.photoCaches) {
        for (const [key, previousData] of context.photoCaches) {
          queryClient.setQueryData(key, previousData);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-photos'] });
    },
  });
}
