import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsService.listReports(),
  });
}

export function useFinalizedInspections() {
  return useQuery({
    queryKey: ['finalized-inspections'],
    queryFn: () => reportsService.listFinalizedInspections(),
  });
}
