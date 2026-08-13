import { supabase } from '@/lib/supabase';
import type { WindFarm, Turbine, Blade, WindFarmDashboardRow } from '@/types';

// ─── Custom Error ───────────────────────────────────────────────────────────

export class AssetServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AssetServiceError';
  }
}

// ─── Error Handling Helpers ─────────────────────────────────────────────────

function handleMutationError(error: { code?: string; message?: string }): never {
  if (error.code === '23505') {
    throw new AssetServiceError('A wind farm with this name already exists', '23505');
  }
  if (error.code === '23503') {
    throw new AssetServiceError(
      'Cannot delete: this asset has linked inspections',
      '23503',
    );
  }
  throw error;
}

// ─── Wind Farm CRUD ─────────────────────────────────────────────────────────

export const assetsService = {
  // Wind Farms

  async getWindFarms(): Promise<WindFarm[]> {
    const { data, error } = await supabase
      .from('wind_farm')
      .select('*')
      .order('name');
    if (error) throw error;
    return data as WindFarm[];
  },

  async getWindFarm(id: string): Promise<WindFarm> {
    const { data, error } = await supabase
      .from('wind_farm')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as WindFarm;
  },

  async createWindFarm(input: {
    name: string;
    location: string;
    latitude?: number;
    longitude?: number;
  }): Promise<WindFarm> {
    const { data, error } = await supabase
      .from('wind_farm')
      .insert({
        name: input.name,
        location: input.location,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      })
      .select()
      .single();
    if (error) handleMutationError(error);
    return data as WindFarm;
  },

  async updateWindFarm(
    id: string,
    input: Partial<{ name: string; location: string; latitude: number | null; longitude: number | null }>,
  ): Promise<WindFarm> {
    const { data, error } = await supabase
      .from('wind_farm')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) handleMutationError(error);
    return data as WindFarm;
  },

  async deleteWindFarm(id: string): Promise<void> {
    const { error } = await supabase.from('wind_farm').delete().eq('id', id);
    if (error) handleMutationError(error);
  },

  // Turbines

  async getTurbines(windFarmId: string): Promise<Turbine[]> {
    const { data, error } = await supabase
      .from('turbine')
      .select('*')
      .eq('wind_farm_id', windFarmId)
      .order('name');
    if (error) throw error;
    return data as Turbine[];
  },

  async createTurbine(input: {
    wind_farm_id: string;
    name: string;
    model?: string;
  }): Promise<Turbine> {
    const { data, error } = await supabase
      .from('turbine')
      .insert({
        wind_farm_id: input.wind_farm_id,
        name: input.name,
        model: input.model ?? null,
      })
      .select()
      .single();
    if (error) handleMutationError(error);
    return data as Turbine;
  },

  async updateTurbine(
    id: string,
    input: Partial<{ name: string; model: string | null; wind_farm_id: string }>,
  ): Promise<Turbine> {
    const { data, error } = await supabase
      .from('turbine')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) handleMutationError(error);
    return data as Turbine;
  },

  async deleteTurbine(id: string): Promise<void> {
    const { error } = await supabase.from('turbine').delete().eq('id', id);
    if (error) handleMutationError(error);
  },

  // Blades

  async getBlades(turbineId: string): Promise<Blade[]> {
    const { data, error } = await supabase
      .from('blade')
      .select('*')
      .eq('turbine_id', turbineId)
      .order('position');
    if (error) throw error;
    return data as Blade[];
  },

  // Asset Tree (nested query)

  async getAssetTree(): Promise<WindFarm[]> {
    const { data, error } = await supabase
      .from('wind_farm')
      .select(`
        *,
        turbines:turbine(
          *,
          blades:blade(*)
        )
      `)
      .order('name');
    if (error) throw error;
    return data as WindFarm[];
  },

  // Wind Farms Dashboard (aggregated data via client-side calculation)

  async getWindFarmsDashboard(): Promise<WindFarmDashboardRow[]> {
    // Client-side aggregation using nested select — both inspection paths
    const { data: farms, error: farmError } = await supabase
      .from('wind_farm')
      .select(`
        id,
        name,
        powering_date,
        turbines:turbine(
          id,
          power_kw,
          blades:blade(
            inspections:inspection(id, created_at)
          ),
          direct_inspections:inspection!inspection_turbine_id_fkey(id, created_at)
        )
      `)
      .order('name');

    if (farmError) throw farmError;

    return ((farms as unknown) as Array<{
      id: string;
      name: string;
      powering_date: string | null;
      turbines: Array<{
        id: string;
        power_kw: number | null;
        blades: Array<{
          inspections: Array<{ id: string; created_at: string }>;
        }>;
        direct_inspections: Array<{ id: string; created_at: string }> | null;
      }> | null;
    }>).map((farm) => {
      const turbines = farm.turbines ?? [];
      // Collect from both paths and deduplicate by id
      const inspMap = new Map<string, { id: string; created_at: string }>();
      for (const t of turbines) {
        for (const b of (t.blades ?? [])) {
          for (const insp of (b.inspections ?? [])) inspMap.set(insp.id, insp);
        }
        for (const insp of (t.direct_inspections ?? [])) inspMap.set(insp.id, insp);
      }
      const allInspections = Array.from(inspMap.values());
      const oldestDate = allInspections.length > 0
        ? allInspections.reduce((min, i) => (i.created_at < min ? i.created_at : min), allInspections[0]!.created_at)
        : null;

      const totalPower = turbines.reduce((sum, t) => sum + (t.power_kw ?? 0), 0);

      return {
        id: farm.id,
        name: farm.name,
        subAssetsCount: turbines.length,
        inspectionsCount: allInspections.length,
        totalPower,
        poweringDate: farm.powering_date,
        oldestInspection: oldestDate,
      };
    });
  },
};
