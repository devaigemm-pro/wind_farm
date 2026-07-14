import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inspectionId: string) => reportsService.generateInspectionReport(inspectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useGenerateConsolidatedReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (windFarmId: string) => reportsService.generateConsolidatedReport(windFarmId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
