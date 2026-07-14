import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evidenceService } from '@/services/evidence.service';

export function useEvidence(inspectionId: string) {
  return useQuery({
    queryKey: ['evidence', inspectionId],
    queryFn: () => evidenceService.listEvidence(inspectionId),
    enabled: !!inspectionId,
  });
}

export function useDeleteEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, storagePath }: { id: string; storagePath: string }) =>
      evidenceService.deleteEvidence(id, storagePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
    },
  });
}
