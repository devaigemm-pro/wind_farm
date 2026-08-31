import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repairService } from '@/services/repair.service';
import type {
  RepairCampaignDetail,
  RepairStagePhotos,
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

// ─── Photos grouped by stage ─────────────────────────────────────────────────

export function useRepairPhotos(campaignId: string | undefined) {
  return useQuery<RepairStagePhotos[]>({
    queryKey: ['repair-photos', campaignId],
    queryFn: () => repairService.getRepairPhotosByStage(campaignId!),
    enabled: !!campaignId,
    staleTime: 30 * 60 * 1000, // signed URLs valid 1h
    gcTime: 60 * 60 * 1000,
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

/** Toggle repair_selected on a photo, then refresh photos + summary (no reload). */
export function useSetPhotoSelected(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, selected }: { photoId: string; selected: boolean }) =>
      repairService.setPhotoSelected(photoId, selected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-photos', campaignId] });
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
