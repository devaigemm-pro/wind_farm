import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetDetailService } from '@/services/asset-detail.service';
import { defectsService, fetchDefectImageMap } from '@/services/defects.service';
import type { DefectImageData } from '@/services/defects.service';
import type {
  WindFarmDetail,
  TurbineSubassetRow,
  Campaign,
  CampaignInspection,
  AssetDocument,
  TurbineSerialNumbers,
  DefectDashboardRow,
} from '@/types';

// ─── Wind Farm Detail ───────────────────────────────────────────────────────

export function useWindFarmDetail(windFarmId: string | undefined) {
  return useQuery<WindFarmDetail>({
    queryKey: ['wind-farm-detail', windFarmId],
    queryFn: () => assetDetailService.getWindFarmDetail(windFarmId!),
    enabled: !!windFarmId,
  });
}

// ─── Subassets ──────────────────────────────────────────────────────────────

export function useSubassets(windFarmId: string | undefined) {
  return useQuery<TurbineSubassetRow[]>({
    queryKey: ['wind-farm-subassets', windFarmId],
    queryFn: () => assetDetailService.getSubassets(windFarmId!),
    enabled: !!windFarmId,
  });
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export function useCampaigns(windFarmId: string | undefined) {
  return useQuery<Campaign[]>({
    queryKey: ['campaigns', windFarmId],
    queryFn: () => assetDetailService.getCampaigns(windFarmId!),
    enabled: !!windFarmId,
  });
}

export function useCampaignInspections(campaignId: string | undefined, windFarmId?: string) {
  return useQuery<CampaignInspection[]>({
    queryKey: ['campaign-inspections', campaignId, windFarmId],
    queryFn: () => assetDetailService.getCampaignInspections(campaignId!, windFarmId),
    enabled: !!campaignId,
  });
}

export function useWindFarmInspections(windFarmId: string | undefined) {
  return useQuery<CampaignInspection[]>({
    queryKey: ['wind-farm-inspections', windFarmId],
    queryFn: () => assetDetailService.getWindFarmInspections(windFarmId!),
    enabled: !!windFarmId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ windFarmId, name }: { windFarmId: string; name: string }) =>
      assetDetailService.createCampaign(windFarmId, name),
    onSuccess: (_, { windFarmId }) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', windFarmId] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, name }: { campaignId: string; name: string }) =>
      assetDetailService.updateCampaign(campaignId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => assetDetailService.deleteCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useAssignInspectionsToCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      inspectionIds,
    }: {
      campaignId: string;
      inspectionIds: string[];
    }) => assetDetailService.assignInspectionsToCampaign(campaignId, inspectionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farm-inspections'] });
    },
  });
}

export function useUnassignInspectionsFromCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inspectionIds: string[]) =>
      assetDetailService.unassignInspectionsFromCampaign(inspectionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farm-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

// ─── Serial Numbers ─────────────────────────────────────────────────────────

export function useSerialNumbers(windFarmId: string | undefined) {
  return useQuery<TurbineSerialNumbers[]>({
    queryKey: ['serial-numbers', windFarmId],
    queryFn: () => assetDetailService.getSerialNumbers(windFarmId!),
    enabled: !!windFarmId,
  });
}

export function useUpdateSerialNumbers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serials: TurbineSerialNumbers[]) =>
      assetDetailService.updateSerialNumbers(serials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farm-subassets'] });
    },
  });
}

// ─── Turbine (Subasset) Detail ───────────────────────────────────────────────

export function useTurbineDetail(turbineId: string | undefined) {
  return useQuery({
    queryKey: ['turbine-detail', turbineId],
    queryFn: () => assetDetailService.getTurbineDetail(turbineId!),
    enabled: !!turbineId,
  });
}

export function useTurbineInspections(turbineId: string | undefined) {
  return useQuery<CampaignInspection[]>({
    queryKey: ['turbine-inspections', turbineId],
    queryFn: () => assetDetailService.getTurbineInspections(turbineId!),
    enabled: !!turbineId,
  });
}

export function useTurbineDefects(turbineId: string | undefined) {
  return useQuery<DefectDashboardRow[]>({
    queryKey: ['turbine-defects', turbineId],
    queryFn: () => defectsService.listDefectsByTurbine(turbineId!),
    enabled: !!turbineId,
  });
}

/**
 * Load defect images in background (non-blocking).
 * Returns a map of defectId → {url, annotX, annotY, annotW, annotH, annotAngle} that updates once loaded.
 */
export function useDefectImages(defectIds: string[]) {
  return useQuery<Record<string, DefectImageData>>({
    queryKey: ['defect-images', ...defectIds.slice(0, 5)],
    queryFn: () => fetchDefectImageMap(defectIds),
    enabled: defectIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useWindFarmDefects(windFarmId: string | undefined) {
  return useQuery<DefectDashboardRow[]>({
    queryKey: ['wind-farm-defects', windFarmId],
    queryFn: () => defectsService.listDefectsByWindFarm(windFarmId!),
    enabled: !!windFarmId,
  });
}

// ─── Turbine Markers (Map) ───────────────────────────────────────────────────

export function useTurbineMarkers(windFarmId: string | undefined) {
  return useQuery<{ id: string; name: string; lat: number; lon: number }[]>({
    queryKey: ['turbine-markers', windFarmId],
    queryFn: () => assetDetailService.getTurbineMarkers(windFarmId!),
    enabled: !!windFarmId,
    staleTime: 60_000,
  });
}

// ─── Documents ──────────────────────────────────────────────────────────────

// ─── Documents ──────────────────────────────────────────────────────────────

export function useAssetDocuments(windFarmId: string | undefined) {
  return useQuery<AssetDocument[]>({
    queryKey: ['asset-documents', windFarmId],
    queryFn: () => assetDetailService.getDocuments(windFarmId!),
    enabled: !!windFarmId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ windFarmId, file }: { windFarmId: string; file: File }) =>
      assetDetailService.uploadDocument(windFarmId, file),
    onSuccess: (_, { windFarmId }) => {
      queryClient.invalidateQueries({ queryKey: ['asset-documents', windFarmId] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, filePath }: { documentId: string; filePath: string }) =>
      assetDetailService.deleteDocument(documentId, filePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-documents'] });
    },
  });
}
