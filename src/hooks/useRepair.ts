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
