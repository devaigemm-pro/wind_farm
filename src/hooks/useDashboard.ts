import { useQuery } from '@tanstack/react-query';
import { dashboardService, type DashboardFilters } from '@/services/dashboard.service';

export function useInspectionPipeline(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'inspection-pipeline', filters],
    queryFn: () => dashboardService.getInspectionPipeline(filters),
    staleTime: 30_000, // 30 seconds
  });
}

export function useDefectsSpread(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'defects-spread', filters],
    queryFn: () => dashboardService.getDefectsSpread(filters),
    staleTime: 30_000,
  });
}

export function useInspectionOperations(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'inspection-operations', filters],
    queryFn: () => dashboardService.getInspectionOperations(filters),
    staleTime: 30_000,
  });
}

export function useSubassetsStatus(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'subassets-status', filters],
    queryFn: () => dashboardService.getSubassetsStatus(filters),
    staleTime: 30_000,
  });
}
