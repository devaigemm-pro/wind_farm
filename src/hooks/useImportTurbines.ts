import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  turbineImportService,
  type TurbineImportSummary,
} from '@/services/turbine-import.service';

/**
 * Bulk-import turbines + blades from an Excel (.xlsx) file. Parses the workbook
 * and inserts one turbine (with its 3 blades) per row, all associated to the
 * selected wind farm. Invalidates the affected queries on success so the new
 * turbines appear in the asset tree and dashboards.
 */
export interface ImportTurbinesVars {
  file: File;
  windFarmId: string;
}

export function useImportTurbines() {
  const queryClient = useQueryClient();
  return useMutation<TurbineImportSummary, Error, ImportTurbinesVars>({
    mutationFn: ({ file, windFarmId }) =>
      turbineImportService.importFromFile(file, windFarmId),
    onSuccess: (_data, { windFarmId }) => {
      queryClient.invalidateQueries({ queryKey: ['turbines', windFarmId] });
      queryClient.invalidateQueries({ queryKey: ['turbines'] });
      queryClient.invalidateQueries({ queryKey: ['asset-tree'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farms-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farms'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farm-subassets', windFarmId] });
      queryClient.invalidateQueries({ queryKey: ['serial-numbers'] });
    },
  });
}
