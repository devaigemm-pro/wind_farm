import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { Campaign, SubassetSelectionRow, CreateCampaignInspectionInput, WindFarmCoordinates } from '@/types';

// ─── Custom Error ───────────────────────────────────────────────────────────

export class NewInspectionServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'NewInspectionServiceError';
  }
}

// ─── Helper: compute relative time ─────────────────────────────────────────

function getRelativeTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'today';
  if (diffDays < 30) return `${diffDays} days`;
  const months = Math.floor(diffDays / 30);
  return `${months} months`;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const newInspectionService = {
  /**
   * Get turbines of a wind farm with last inspection data and defect counts
   * for the subassets selection table.
   */
  async getSubassetsForSelection(windFarmId: string): Promise<SubassetSelectionRow[]> {
    const { data: turbines, error } = await supabase
      .from('turbine')
      .select(`
        id, name, model,
        blades:blade(
          inspections:inspection(
            id, created_at,
            defects:defect(id)
          )
        )
      `)
      .eq('wind_farm_id', windFarmId)
      .order('name');

    if (error) throw new NewInspectionServiceError(error.message, error.code);

    return ((turbines as unknown[]) ?? []).map((t: unknown) => {
      const turbine = t as Record<string, unknown>;
      const blades = (turbine.blades as Array<Record<string, unknown>>) ?? [];

      // Flatten all inspections from all blades
      const allInspections = blades.flatMap(
        (b) => (b.inspections as Array<Record<string, unknown>>) ?? [],
      );

      // Find the latest inspection
      let lastInspDate: string | null = null;
      let lastDefectsCount = 0;

      if (allInspections.length > 0) {
        const sorted = allInspections.sort(
          (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime(),
        );
        lastInspDate = sorted[0]!.created_at as string;
        lastDefectsCount = ((sorted[0]!.defects as unknown[]) ?? []).length;
      }

      return {
        id: turbine.id as string,
        name: turbine.name as string,
        model: (turbine.model as string) ?? null,
        lastInspectionDate: getRelativeTime(lastInspDate),
        lastDefectsCount,
        selected: true,
      };
    });
  },

  /**
   * Get geographic coordinates of a wind farm for the Windy iframe.
   */
  async getWindFarmCoordinates(windFarmId: string): Promise<WindFarmCoordinates | null> {
    const { data, error } = await db
      .from('wind_farm')
      .select('latitude, longitude')
      .eq('id', windFarmId)
      .single();

    if (error) throw new NewInspectionServiceError(error.message, error.code);

    const row = data as Record<string, unknown>;
    const lat = row.latitude as number | null;
    const lon = row.longitude as number | null;

    if (lat === null || lon === null) return null;

    return { latitude: lat, longitude: lon };
  },

  /**
   * Create a campaign with multiple inspections (one per selected turbine).
   * 1. Creates the campaign.
   * 2. For each selected turbine, gets the first blade and creates an inspection.
   * 3. Returns the campaign and inspection IDs.
   */
  async createCampaignWithInspections(
    input: CreateCampaignInspectionInput,
  ): Promise<{ campaign: Campaign; inspectionIds: string[] }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new NewInspectionServiceError('User must be authenticated');
    }

    // Step 1: Create campaign
    const { data: campaignData, error: campaignError } = await db
      .from('campaign')
      .insert({
        name: input.campaignName,
        wind_farm_id: input.windFarmId,
        created_by: user.id,
      })
      .select()
      .single();

    if (campaignError) {
      throw new NewInspectionServiceError(
        `Failed to create campaign: ${campaignError.message}`,
        campaignError.code,
      );
    }

    const campaignRow = campaignData as Record<string, unknown>;
    const campaign: Campaign = {
      id: campaignRow.id as string,
      name: campaignRow.name as string,
      windFarmId: campaignRow.wind_farm_id as string,
      createdBy: campaignRow.created_by as string | null,
      createdAt: campaignRow.created_at as string,
      updatedAt: campaignRow.updated_at as string,
    };

    // Step 2: For each turbine, create ONE inspection (covers all 3 blades)
    const inspectionIds: string[] = [];

    for (const turbineId of input.selectedTurbineIds) {
      const inspection = await this._createSingleInspection(
        turbineId, user.id, campaign.id, input,
      );
      if (inspection) inspectionIds.push(inspection);
    }

    return { campaign, inspectionIds };
  },

  /** @internal Create a single inspection record for a turbine (covers all blades) */
  async _createSingleInspection(
    turbineId: string,
    inspectorId: string,
    campaignId: string,
    input: CreateCampaignInspectionInput,
  ): Promise<string | null> {
    const { data, error } = await db
      .from('inspection')
      .insert({
        turbine_id: turbineId,
        blade_id: null,
        inspector_id: inspectorId,
        campaign_id: campaignId,
        inspection_type: input.inspectionType,
        scheduled_date: input.scheduledDate,
        notes: input.notes || null,
        status: 'in_progress',
        stage: 'planned',
      })
      .select('id')
      .single();

    if (error) {
      return null;
    }

    return (data as Record<string, unknown>).id as string;
  },
};
