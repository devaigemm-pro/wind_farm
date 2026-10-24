import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hoistCertificationService } from '@/services/hoistCertification.service';
import type {
  HoistCampaignDetail,
  HoistTree,
  HoistItemNode,
  HoistSummary,
} from '@/services/hoistCertification.service';
import type { HoistCertificationStatus } from '@/types';

// ─── Hoist campaign header ────────────────────────────────────────────────────

export function useHoistCampaignDetail(campaignId: string | undefined) {
  return useQuery<HoistCampaignDetail>({
    queryKey: ['hoist-cert-campaign-detail', campaignId],
    queryFn: () => hoistCertificationService.getHoistCampaign(campaignId!),
    enabled: !!campaignId,
  });
}

// ─── Hoist tree (steps → groups → typed items) ─────────────────────────────────

export function useHoistTree(campaignId: string | undefined) {
  return useQuery<HoistTree>({
    queryKey: ['hoist-cert-tree', campaignId],
    queryFn: () => hoistCertificationService.getHoistTree(campaignId!),
    enabled: !!campaignId,
    // Photos resolve to PUBLIC URLs (no expiry), so a short stale window is fine.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ─── Hoist summary (campaigns panel row) ───────────────────────────────────────

export function useHoistSummary(campaignId: string | undefined) {
  return useQuery<HoistSummary>({
    queryKey: ['hoist-cert-summary', campaignId],
    queryFn: () => hoistCertificationService.getHoistSummary(campaignId!),
    enabled: !!campaignId,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Map a mutation fn over every typed item node (direct or grouped) of the tree. */
function mapItems(
  tree: HoistTree,
  fn: (node: HoistItemNode) => HoistItemNode,
): HoistTree {
  return tree.map((step) => ({
    ...step,
    items: step.items.map(fn),
    groups: step.groups.map((g) => ({ ...g, items: g.items.map(fn) })),
  }));
}

/**
 * Toggle a photo's selection for the report (persisted in
 * hoist_cert_photo.metadata.selected_for_report), then refresh tree + summary.
 * Optimistically flips the photo's selection so it moves between columns instantly
 * without waiting for the getHoistTree pipeline to refetch. Mirrors
 * useSetCleaningPhotoSelected in useCleaning.
 */
export function useSetHoistPhotoSelected(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, selected }: { photoId: string; selected: boolean }) =>
      hoistCertificationService.setPhotoSelected(photoId, selected),
    onMutate: async ({ photoId, selected }) => {
      const treeKey = ['hoist-cert-tree', campaignId];
      await queryClient.cancelQueries({ queryKey: treeKey });
      const prev = queryClient.getQueryData<HoistTree>(treeKey);
      if (prev) {
        const next = mapItems(prev, (node) => ({
          ...node,
          photos: node.photos.map((photo) =>
            photo.id === photoId ? { ...photo, hoistSelected: selected } : photo,
          ),
        }));
        queryClient.setQueryData(treeKey, next);
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['hoist-cert-tree', campaignId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['hoist-cert-summary', campaignId] });
      queryClient.invalidateQueries({
        queryKey: ['hoist-cert-tree', campaignId],
        refetchType: 'none',
      });
    },
  });
}

/**
 * Move a photo to a DIFFERENT item (fixing a wrong-item upload). Optimistically
 * moves the photo from its origin item's photos[] to the target item's photos[]
 * in the cached tree so it jumps columns instantly, with rollback on error.
 * Mirrors useMovePhotoToZone in useCleaning: find the moving photo anywhere in
 * the tree, remove it from its origin item, append it to the target item
 * (matched by itemId when present, else itemCode), re-sort by captureOrder.
 * Only items that hold photos ('photo' / 'measurement') participate.
 */
export function useMoveHoistPhoto(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      photoId,
      targetItemId,
      targetItemCode,
    }: {
      photoId: string;
      targetItemId: string | null;
      targetItemCode: string;
    }) =>
      hoistCertificationService.movePhotoBetweenItems(photoId, targetItemId, targetItemCode),
    onMutate: async ({ photoId, targetItemId, targetItemCode }) => {
      const treeKey = ['hoist-cert-tree', campaignId];
      await queryClient.cancelQueries({ queryKey: treeKey });
      const prev = queryClient.getQueryData<HoistTree>(treeKey);
      if (prev) {
        // Find the moving photo anywhere in the tree.
        let moving: HoistItemNode['photos'][number] | undefined;
        for (const step of prev) {
          for (const it of step.items) {
            const found = it.photos.find((p) => p.id === photoId);
            if (found) {
              moving = found;
              break;
            }
          }
          if (moving) break;
          for (const g of step.groups) {
            for (const it of g.items) {
              const found = it.photos.find((p) => p.id === photoId);
              if (found) {
                moving = found;
                break;
              }
            }
            if (moving) break;
          }
          if (moving) break;
        }
        if (moving) {
          const movedPhoto = {
            ...moving,
            hoistItemId: targetItemId,
            itemCode: targetItemCode,
          };
          // Matches the target item: by itemId when both present, else by itemCode.
          const isTarget = (node: HoistItemNode) =>
            targetItemId != null && node.itemId != null
              ? node.itemId === targetItemId
              : node.itemCode === targetItemCode;

          const applyItem = (node: HoistItemNode): HoistItemNode => {
            if (node.photos.some((p) => p.id === photoId)) {
              // Remove from origin.
              return { ...node, photos: node.photos.filter((p) => p.id !== photoId) };
            }
            if (isTarget(node)) {
              // Append to target, keep captureOrder order.
              const photos = [...node.photos, movedPhoto].sort(
                (a, b) => a.captureOrder - b.captureOrder,
              );
              return { ...node, photos };
            }
            return node;
          };

          const next = mapItems(prev, applyItem);
          queryClient.setQueryData(treeKey, next);
        }
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['hoist-cert-tree', campaignId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['hoist-cert-summary', campaignId] });
      queryClient.invalidateQueries({
        queryKey: ['hoist-cert-tree', campaignId],
        refetchType: 'none',
      });
    },
  });
}

/**
 * Update hoist-certification campaign status, then refresh detail + summary +
 * the wind farm campaigns list (so the panel status badge updates without a
 * reload).
 */
export function useUpdateHoistStatus(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: HoistCertificationStatus) =>
      hoistCertificationService.updateHoistStatus(campaignId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoist-cert-campaign-detail', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['hoist-cert-summary', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}
