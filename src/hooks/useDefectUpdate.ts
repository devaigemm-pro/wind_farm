import { useMutation, useQueryClient } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';

export interface DefectUpdateParams {
  id: string;
  type: string;
  category: number;
  rootDistance: number;
  side: string;
  notes: string;
  rootCause: string;
  nextStep: string;
}

export function useDefectUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: DefectUpdateParams) =>
      defectsService.updateDefectFields(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farm-defects'] });
      queryClient.invalidateQueries({ queryKey: ['turbine-defects'] });
    },
  });
}
