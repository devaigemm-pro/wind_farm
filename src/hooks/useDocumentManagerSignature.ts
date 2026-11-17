import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentManagerSignatureService } from '@/services/document-manager-signature.service';

/** Signed preview URL of a manager's signature (null when none uploaded). */
export function useDocumentManagerSignature(managerName: string) {
  return useQuery<string | null>({
    queryKey: ['document-manager-signature', managerName],
    queryFn: () => documentManagerSignatureService.getSignedUrl(managerName),
    enabled: !!managerName,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadDocumentManagerSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ managerName, file }: { managerName: string; file: File }) =>
      documentManagerSignatureService.upload(managerName, file),
    onSuccess: (_data, { managerName }) => {
      queryClient.invalidateQueries({ queryKey: ['document-manager-signature', managerName] });
    },
  });
}
