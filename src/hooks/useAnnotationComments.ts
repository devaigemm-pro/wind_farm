import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { annotationCommentsService } from '@/services/annotation-comments.service';

export function useAnnotationComments(annotationId: string | undefined) {
  return useQuery({
    queryKey: ['annotation-comments', annotationId],
    queryFn: () => annotationCommentsService.list(annotationId!),
    enabled: !!annotationId,
  });
}

export function useAddAnnotationComment(annotationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => annotationCommentsService.create(annotationId!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotation-comments', annotationId] });
    },
  });
}
