import { useQuery } from '@tanstack/react-query';
import { defectsService } from '@/services/defects.service';

export interface UseDefectsDashboardParams {
  search: string;
  page: number;
  rowsPerPage: number;
  sortField: string;
  sortDir: 'asc' | 'desc';
}

export function useDefectsDashboard(params: UseDefectsDashboardParams) {
  return useQuery({
    queryKey: ['defects-dashboard', params],
    queryFn: () =>
      defectsService.listDefectsDashboard({
        search: params.search,
        limit: params.rowsPerPage,
        offset: (params.page - 1) * params.rowsPerPage,
        sortField: params.sortField,
        sortDir: params.sortDir,
      }),
    placeholderData: (prev) => prev,
  });
}
