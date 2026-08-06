import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';

export function useDefectComments(defectId: string | null) {
  return useQuery({
    queryKey: ['defect-comments', defectId],
    queryFn: () => defectsService.getDefectComments(defectId!),
    enabled: !!defectId,
  });
}

export function useAddDefectComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ defectId, text }: { defectId: string; text: string }) =>
      defectsService.addDefectComment(defectId, text),
    onSuccess: (_, { defectId }) => {
      queryClient.invalidateQueries({ queryKey: ['defect-comments', defectId] });
    },
  });
}
