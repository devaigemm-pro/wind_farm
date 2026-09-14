import { useMutation, useQueryClient } from '@tanstack/react-query';
import { repairImportService, type RepairImportSummary } from '@/services/repair-import.service';

/**
 * Import a repair campaign from an Excel (.xlsx) file. Parses the workbook,
 * creates/reuses the repair campaign per turbine and links each defect into the
 * repair tree. Invalidates the affected queries on success.
 */
export function useImportRepairCampaign() {
  const queryClient = useQueryClient();
  return useMutation<RepairImportSummary, Error, File>({
    mutationFn: (file: File) => repairImportService.importFromFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload-records'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['traceability'] });
      queryClient.invalidateQueries({ queryKey: ['defects'] });
    },
  });
}
