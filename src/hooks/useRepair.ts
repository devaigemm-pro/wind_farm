import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repairService } from '@/services/repair.service';
import type {
  RepairCampaignDetail,
  RepairTree,
  RepairSummary,
} from '@/services/repair.service';
import type { RepairCampaignStatus } from '@/types';

// ─── Repair campaign header ──────────────────────────────────────────────────

export function useRepairCampaignDetail(campaignId: string | undefined) {
  return useQuery<RepairCampaignDetail>({
    queryKey: ['repair-campaign-detail', campaignId],
    queryFn: () => repairService.getRepairCampaign(campaignId!),
    enabled: !!campaignId,
  });
}

// ─── Repair tree (defects → 11 stages → photos) ──────────────────────────────

export function useRepairTree(campaignId: string | undefined) {
  return useQuery<RepairTree>({
    queryKey: ['repair-tree', campaignId],
    queryFn: () => repairService.getRepairTree(campaignId!),
    enabled: !!campaignId,
    // Photos resolve to PUBLIC URLs (no expiry), so a short stale window is fine.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ─── Repair summary (campaigns panel row) ────────────────────────────────────

export function useRepairSummary(campaignId: string | undefined) {
  return useQuery<RepairSummary>({
    queryKey: ['repair-summary', campaignId],
    queryFn: () => repairService.getRepairSummary(campaignId!),
    enabled: !!campaignId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Toggle a photo's selection for the report (persisted in
 * repair_photo.metadata.selected_for_report), then refresh tree + summary
 * via react-query invalidation (no page reload).
 */
export function useSetPhotoSelected(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, selected }: { photoId: string; selected: boolean }) =>
      repairService.setPhotoSelected(photoId, selected),
    // Optimistically flip the photo between columns so it moves instantly,
    // without waiting for the heavy getRepairTree pipeline to refetch.
    onMutate: async ({ photoId, selected }) => {
      const treeKey = ['repair-tree', campaignId];
      await queryClient.cancelQueries({ queryKey: treeKey });
      const prev = queryClient.getQueryData<RepairTree>(treeKey);
      if (prev) {
        const next: RepairTree = prev.map((node) => ({
          ...node,
          stages: node.stages.map((stage) => ({
            ...stage,
            photos: stage.photos.map((photo) =>
              photo.id === photoId ? { ...photo, repairSelected: selected } : photo,
            ),
          })),
        }));
        queryClient.setQueryData(treeKey, next);
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['repair-tree', campaignId], context.prev);
      }
    },
    onSettled: () => {
      // The DB write already happened and the optimistic update left the photo
      // in the correct column. Refresh the summary (selected counter), but only
      // mark the tree stale (no immediate refetch) to avoid a reorder/flicker.
      queryClient.invalidateQueries({ queryKey: ['repair-summary', campaignId] });
      queryClient.invalidateQueries({
        queryKey: ['repair-tree', campaignId],
        refetchType: 'none',
      });
    },
  });
}

/**
 * Permanently delete a defect from the repair campaign (whole chain:
 * repair_photo → repair_stage → repair → work_order → quote_item → defect),
 * then refresh tree + summary via react-query invalidation.
 */
export function useDeleteRepairDefect(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workOrderId,
      repairId,
      defectId,
    }: {
      workOrderId: string | null;
      repairId: string | null;
      defectId: string | null;
    }) => repairService.deleteRepairDefect({ workOrderId, repairId, defectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-tree', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['repair-summary', campaignId] });
    },
  });
}

/** Update repair campaign status, then refresh detail + summary. */
export function useUpdateRepairStatus(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: RepairCampaignStatus) =>
      repairService.updateRepairStatus(campaignId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-campaign-detail', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['repair-summary', campaignId] });
    },
  });
}
