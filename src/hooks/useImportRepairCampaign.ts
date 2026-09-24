import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  repairImportService,
  type RepairImportSummary,
  type DefectImport,
  type DefectImportRow,
} from '@/services/repair-import.service';

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
      queryClient.invalidateQueries({ queryKey: ['defect-imports'] });
    },
  });
}

/** Persistent history of defect-spreadsheet imports (all users, newest first). */
export function useDefectImports() {
  return useQuery<DefectImport[]>({
    queryKey: ['defect-imports'],
    queryFn: () => repairImportService.getDefectImports(),
  });
}

/** Snapshot rows of a single defect-import batch. Disabled when no id is given. */
export function useDefectImportRows(importId: string | null) {
  return useQuery<DefectImportRow[]>({
    queryKey: ['defect-import-rows', importId],
    queryFn: () => repairImportService.getDefectImportRows(importId as string),
    enabled: !!importId,
  });
}
