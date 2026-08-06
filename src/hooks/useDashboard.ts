import { useQuery } from '@tanstack/react-query';
import { dashboardService, type DashboardFilters } from '@/services/dashboard.service';

export function useInspectionPipeline(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'inspection-pipeline', filters],
    queryFn: () => dashboardService.getInspectionPipeline(filters),
  });
}

export function useDefectsSpread(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'defects-spread', filters],
    queryFn: () => dashboardService.getDefectsSpread(filters),
  });
}

export function useInspectionOperations(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'inspection-operations', filters],
    queryFn: () => dashboardService.getInspectionOperations(filters),
  });
}

export function useSubassetsStatus(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'subassets-status', filters],
    queryFn: () => dashboardService.getSubassetsStatus(filters),
  });
}
