import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { evidenceService } from '@/services/evidence.service';

export function useEvidenceUpload(inspectionId: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      setProgress(10); // Start
      const result = await evidenceService.uploadEvidence(inspectionId, file);
      setProgress(100);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', inspectionId] });
      setTimeout(() => setProgress(0), 500); // Reset after brief delay
    },
    onError: () => {
      setProgress(0);
    },
  });

  return {
    upload: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    progress,
  };
}
