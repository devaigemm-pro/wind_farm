import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { newInspectionService } from '@/services/new-inspection.service';
import type { CreateCampaignInspectionInput } from '@/types';

/** Fetch list of wind farms (id + name) for the asset selector dropdown */
export function useWindFarmsList() {
  return useQuery({
    queryKey: ['wind-farms-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wind_farm')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

/** Fetch subassets (turbines) for a given wind farm for the selection table */
export function useSubassetsForSelection(windFarmId: string | null) {
  return useQuery({
    queryKey: ['subassets-selection', windFarmId],
    queryFn: () => newInspectionService.getSubassetsForSelection(windFarmId!),
    enabled: !!windFarmId,
  });
}

/** Fetch wind farm geographic coordinates for the Windy iframe */
export function useWindFarmCoordinates(windFarmId: string | null) {
  return useQuery({
    queryKey: ['wind-farm-coordinates', windFarmId],
    queryFn: () => newInspectionService.getWindFarmCoordinates(windFarmId!),
    enabled: !!windFarmId,
  });
}

/** Mutation to create a campaign with multiple inspections */
export function useCreateCampaignInspections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCampaignInspectionInput) =>
      newInspectionService.createCampaignWithInspections(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['wind-farms-dashboard'] });
    },
  });
}
