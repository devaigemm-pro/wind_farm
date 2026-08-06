import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface FilterOption {
  label: string;
  value: string;
}

interface DashboardFilterOptions {
  farmOptions: FilterOption[];
  modelOptions: FilterOption[];
  typeOptions: FilterOption[];
}

async function fetchFilterOptions(): Promise<DashboardFilterOptions> {
  // Fetch wind farms
  const { data: farms } = await supabase
    .from('wind_farm')
    .select('id, name')
    .order('name');

  const farmOptions: FilterOption[] = [
    { label: 'All Farms', value: '' },
    ...((farms ?? []) as Array<{ id: string; name: string }>).map((f) => ({
      label: f.name,
      value: f.id,
    })),
  ];

  // Fetch unique turbine models
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: turbines } = await db
    .from('turbine')
    .select('model')
    .not('model', 'is', null);

  const uniqueModels = [...new Set(
    ((turbines ?? []) as Array<{ model: string }>)
      .map((t) => t.model)
      .filter(Boolean),
  )].sort();

  const modelOptions: FilterOption[] = [
    { label: 'All Models', value: '' },
    ...uniqueModels.map((m: string) => ({
      label: m,
      value: m,
    })),
  ];

  // Fetch unique defect types
  const { data: defects } = await db
    .from('defect')
    .select('type')
    .not('type', 'is', null);

  const uniqueTypes = [...new Set(
    ((defects ?? []) as Array<{ type: string }>)
      .map((d) => d.type)
      .filter(Boolean),
  )].sort();

  const typeOptions: FilterOption[] = [
    { label: 'All Types', value: '' },
    ...uniqueTypes.map((t: string) => ({
      label: t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' '),
      value: t,
    })),
  ];

  return { farmOptions, modelOptions, typeOptions };
}

export function useDashboardFilters() {
  return useQuery<DashboardFilterOptions>({
    queryKey: ['dashboard-filters'],
    queryFn: fetchFilterOptions,
    staleTime: 60_000, // 1 minute
  });
}
