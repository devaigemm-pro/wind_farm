import { useMutation, useQueryClient } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';

export function useDefectDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => defectsService.deleteDefect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects-dashboard'] });
    },
  });
}
