import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cleaningService } from '@/services/cleaning.service';
import type {
  CleaningCampaignDetail,
  CleaningTree,
  CleaningZoneNode,
  CleaningSummary,
} from '@/services/cleaning.service';
import type { CleaningCampaignStatus } from '@/types';

// ─── Cleaning campaign header ────────────────────────────────────────────────

export function useCleaningCampaignDetail(campaignId: string | undefined) {
  return useQuery<CleaningCampaignDetail>({
    queryKey: ['cleaning-campaign-detail', campaignId],
    queryFn: () => cleaningService.getCleaningCampaign(campaignId!),
    enabled: !!campaignId,
  });
}

// ─── Cleaning tree (zones → sub-zones → photos) ──────────────────────────────

export function useCleaningTree(campaignId: string | undefined) {
  return useQuery<CleaningTree>({
    queryKey: ['cleaning-tree', campaignId],
    queryFn: () => cleaningService.getCleaningTree(campaignId!),
    enabled: !!campaignId,
    // Photos resolve to PUBLIC URLs (no expiry), so a short stale window is fine.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ─── Cleaning summary (campaigns panel row) ──────────────────────────────────

export function useCleaningSummary(campaignId: string | undefined) {
  return useQuery<CleaningSummary>({
    queryKey: ['cleaning-summary', campaignId],
    queryFn: () => cleaningService.getCleaningSummary(campaignId!),
    enabled: !!campaignId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Map a mutation fn over every leaf node (and sub-zone) of the cached tree. */
function mapLeaves(
  tree: CleaningTree,
  fn: (node: CleaningZoneNode) => CleaningZoneNode,
): CleaningTree {
  return tree.map((node) => {
    if (node.isLeaf) return fn(node);
    return { ...node, children: node.children.map((child) => (child.isLeaf ? fn(child) : child)) };
  });
}

/**
 * Toggle a photo's selection for the report (persisted in
 * cleaning_photo.metadata.selected_for_report), then refresh tree + summary.
 * Optimistically flips the photo between columns so it moves instantly without
 * waiting for the getCleaningTree pipeline to refetch. Mirrors
 * useSetPhotoSelected in useRepair.
 */
export function useSetCleaningPhotoSelected(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, selected }: { photoId: string; selected: boolean }) =>
      cleaningService.setPhotoSelected(photoId, selected),
    onMutate: async ({ photoId, selected }) => {
      const treeKey = ['cleaning-tree', campaignId];
      await queryClient.cancelQueries({ queryKey: treeKey });
      const prev = queryClient.getQueryData<CleaningTree>(treeKey);
      if (prev) {
        const next = mapLeaves(prev, (node) => ({
          ...node,
          photos: node.photos.map((photo) =>
            photo.id === photoId ? { ...photo, cleaningSelected: selected } : photo,
          ),
        }));
        queryClient.setQueryData(treeKey, next);
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['cleaning-tree', campaignId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning-summary', campaignId] });
      queryClient.invalidateQueries({
        queryKey: ['cleaning-tree', campaignId],
        refetchType: 'none',
      });
    },
  });
}

/**
 * Move a photo to a DIFFERENT zone/sub-zone (fixing a wrong-zone upload).
 * Optimistically moves the photo from its origin zone's photos[] to the target
 * zone's photos[] in the cached tree so it jumps columns instantly, with
 * rollback on error. Mirrors useMovePhotoToStage in useRepair (same robust
 * pattern): find the moving photo anywhere in the tree, remove it from its
 * origin leaf, append it to the target leaf (matched by zoneId when present,
 * else zoneCode for catalog-fallback leaves), re-sort by captureOrder.
 */
export function useMovePhotoToZone(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      photoId,
      targetZoneId,
      targetZoneCode,
    }: {
      photoId: string;
      targetZoneId: string | null;
      targetZoneCode: string;
    }) => cleaningService.movePhotoToZone(photoId, targetZoneId, targetZoneCode),
    onMutate: async ({ photoId, targetZoneId, targetZoneCode }) => {
      const treeKey = ['cleaning-tree', campaignId];
      await queryClient.cancelQueries({ queryKey: treeKey });
      const prev = queryClient.getQueryData<CleaningTree>(treeKey);
      if (prev) {
        // Find the moving photo anywhere in the tree.
        let moving: CleaningZoneNode['photos'][number] | undefined;
        for (const node of prev) {
          const inRoot = node.photos.find((p) => p.id === photoId);
          if (inRoot) {
            moving = inRoot;
            break;
          }
          for (const child of node.children) {
            const inChild = child.photos.find((p) => p.id === photoId);
            if (inChild) {
              moving = inChild;
              break;
            }
          }
          if (moving) break;
        }
        if (moving) {
          const movedPhoto = {
            ...moving,
            cleaningZoneId: targetZoneId,
            zoneCode: targetZoneCode,
          };
          // Matches the target leaf: by zoneId when both present, else by zoneCode.
          const isTarget = (node: CleaningZoneNode) =>
            targetZoneId != null && node.zoneId != null
              ? node.zoneId === targetZoneId
              : node.zoneCode === targetZoneCode;

          const applyLeaf = (node: CleaningZoneNode): CleaningZoneNode => {
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

          const next = mapLeaves(prev, applyLeaf);
          queryClient.setQueryData(treeKey, next);
        }
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['cleaning-tree', campaignId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning-summary', campaignId] });
      queryClient.invalidateQueries({
        queryKey: ['cleaning-tree', campaignId],
        refetchType: 'none',
      });
    },
  });
}

/**
 * Update cleaning campaign status, then refresh detail + summary + the wind
 * farm campaigns list (so the panel status badge updates without a reload).
 */
export function useUpdateCleaningStatus(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: CleaningCampaignStatus) =>
      cleaningService.updateCleaningStatus(campaignId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning-campaign-detail', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['cleaning-summary', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}
