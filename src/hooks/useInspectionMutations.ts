import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionsService } from '@/services/inspections.service';
import { inspectionTransitionsService } from '@/services/inspection-transitions.service';

export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { blade_id: string; scheduled_date: string }) =>
      inspectionsService.createInspection(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });
}

export function useCompleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inspectionId: string) =>
      inspectionTransitionsService.completeInspection(inspectionId),
    onSuccess: (_data, inspectionId) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
    },
  });
}

export function useApproveInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inspectionId: string) =>
      inspectionTransitionsService.approveInspection(inspectionId),
    onSuccess: (_data, inspectionId) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
    },
  });
}
