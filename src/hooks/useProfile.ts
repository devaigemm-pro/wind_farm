import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { WindFarm } from '@/types';
import type { TurbineMarker } from '@/components/organisms/CampaignMap';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  windFarms: WindFarm[];
  totalAssets: number;
  totalPowerKw: number;
  turbineMarkers: TurbineMarker[];
}

export function useProfile() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['profile-data', user?.id],
    queryFn: async (): Promise<ProfileData> => {
      if (!user) throw new Error('No user');

      // Parse name
      const parts = (user.name ?? '').split(' ');
      const firstName = parts[0] ?? '';
      const lastName = parts.slice(1).join(' ') ?? '';

      // Fetch wind farms
      const { data: farms, error: farmsErr } = await supabase
        .from('wind_farm')
        .select('*')
        .order('name');
      if (farmsErr) throw farmsErr;

      const windFarms = (farms ?? []) as WindFarm[];

      // Fetch turbines to count assets, total power, and map markers
      const { data: turbines, error: turbinesErr } = await supabase
        .from('turbine')
        .select('id, name, power_kw, latitude, longitude');
      if (turbinesErr) throw turbinesErr;

      const totalAssets = turbines?.length ?? 0;
      const totalPowerKw = (turbines ?? []).reduce(
        (sum, t) => sum + (t.power_kw ?? 0),
        0,
      );

      // Build turbine markers for the map
      // First try turbine-level coordinates; if none have coords, use wind farm locations
      let turbineMarkers: TurbineMarker[] = (turbines ?? [])
        .filter((t) => t.latitude != null && t.longitude != null)
        .map((t) => ({
          id: t.id as string,
          name: t.name as string,
          lat: Number(t.latitude),
          lon: Number(t.longitude),
        }));

      // Fallback: if no turbines have coordinates, place a marker per wind farm
      if (turbineMarkers.length === 0) {
        turbineMarkers = windFarms
          .filter((wf) => wf.latitude != null && wf.longitude != null)
          .map((wf) => ({
            id: wf.id,
            name: wf.name,
            lat: Number(wf.latitude),
            lon: Number(wf.longitude),
          }));
      }

      return {
        firstName,
        lastName,
        email: user.email ?? '',
        role: user.role ?? '',
        windFarms,
        totalAssets,
        totalPowerKw,
        turbineMarkers,
      };
    },
    enabled: !!user,
  });

  return { data, isLoading };
}

export function useUpdateProfileName() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (fullName: string) => {
      if (!user) throw new Error('No user');
      const { error } = await supabase
        .from('profiles')
        .update({ name: fullName })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-data'] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    },
  });
}
