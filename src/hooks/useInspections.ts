import { useQuery } from '@tanstack/react-query';
import { inspectionsService, type InspectionFilters } from '@/services/inspections.service';

export function useInspections(filters?: InspectionFilters, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['inspections', filters, page, pageSize],
    queryFn: () => inspectionsService.getInspections(filters, page, pageSize),
  });
}
