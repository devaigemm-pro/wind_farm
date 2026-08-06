import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { Defect, DefectType, Severity, DefectDashboardRow, DefectComment } from '@/types';
import { BLADE_POSITION_LABELS, DEFECT_TYPE_DISPLAY_LABELS } from '@/types';

// ─── Defect type → test image mapping ───────────────────────────────────────

function getDefectImageByType(type: string): string {
  const map: Record<string, string> = {
    le_erosion: '/test-images/defect-erosion-close.svg',
    vortex: '/test-images/defect-vortex-close.svg',
    paint_defect: '/test-images/defect-paint-close.svg',
    crack: '/test-images/defect-crack-close.svg',
    delamination: '/test-images/defect-delamination-close.svg',
    lightning_damage: '/test-images/defect-crack-close.svg',
    other: '/test-images/defect-blade-close.svg',
  };
  return map[type] || '/test-images/defect-blade-close.svg';
}

// ─── Custom Error ───────────────────────────────────────────────────────────

export class DefectServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'DefectServiceError';
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export const defectsService = {
  /**
   * List all defects for an inspection, including linked evidence images.
   */
  async listDefects(inspectionId: string): Promise<Defect[]> {
    const { data, error } = await supabase
      .from('defect')
      .select(
        `
        *,
        images:defect_image(
          evidence:evidence(*)
        )
      `,
      )
      .eq('inspection_id', inspectionId)
      .order('distance_from_root', { ascending: true });

    if (error) throw new DefectServiceError(error.message, error.code);

    // Flatten the nested join structure: defect_image -> evidence
    const defects = (data ?? []).map((row) => {
      const { images, ...defect } = row as Record<string, unknown>;
      return {
        ...defect,
        images: Array.isArray(images)
          ? images
              .map((link: Record<string, unknown>) => link.evidence)
              .filter(Boolean)
          : [],
      } as unknown as Defect;
    });

    return defects;
  },

  /**
   * Create a new defect for an inspection.
   */
  async createDefect(input: {
    inspection_id: string;
    type: DefectType;
    severity: Severity;
    distance_from_root: number;
    description?: string;
  }): Promise<Defect> {
    const { data, error } = await supabase
      .from('defect')
      .insert({
        inspection_id: input.inspection_id,
        type: input.type,
        severity: input.severity,
        distance_from_root: input.distance_from_root,
        description: input.description ?? null,
      })
      .select()
      .single();

    if (error) throw new DefectServiceError(error.message, error.code);
    return data as unknown as Defect;
  },

  /**
   * Update an existing defect's fields.
   */
  async updateDefect(
    id: string,
    input: Partial<{
      type: DefectType;
      severity: Severity;
      distance_from_root: number;
      description: string | null;
    }>,
  ): Promise<Defect> {
    const { data, error } = await supabase
      .from('defect')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DefectServiceError(error.message, error.code);
    return data as unknown as Defect;
  },

  /**
   * Delete a defect. Cascade on defect_image handles link cleanup.
   */
  async deleteDefect(id: string): Promise<void> {
    const { error } = await supabase.from('defect').delete().eq('id', id);
    if (error) throw new DefectServiceError(error.message, error.code);
  },

  /**
   * Link evidence images to a defect via the defect_image junction table.
   */
  async linkImages(defectId: string, evidenceIds: string[]): Promise<void> {
    if (evidenceIds.length === 0) return;

    const rows = evidenceIds.map((evidenceId) => ({
      defect_id: defectId,
      evidence_id: evidenceId,
    }));

    const { error } = await supabase.from('defect_image').insert(rows);
    if (error) throw new DefectServiceError(error.message, error.code);
  },

  /**
   * Unlink evidence images from a defect.
   */
  async unlinkImages(defectId: string, evidenceIds: string[]): Promise<void> {
    if (evidenceIds.length === 0) return;

    const { error } = await supabase
      .from('defect_image')
      .delete()
      .eq('defect_id', defectId)
      .in('evidence_id', evidenceIds);

    if (error) throw new DefectServiceError(error.message, error.code);
  },

  // ─── Dashboard Methods ──────────────────────────────────────────────────────

  /**
   * List defects for the Wind Farms dashboard with pagination, sorting, and search.
   */
  async listDefectsDashboard(params: {
    search?: string;
    limit?: number;
    offset?: number;
    sortField?: string;
    sortDir?: 'asc' | 'desc';
    turbineId?: string;
  }): Promise<{ data: DefectDashboardRow[]; totalCount: number }> {
    const { data, error } = await db.rpc('get_defects_dashboard', {
      p_search: params.search ?? '',
      p_limit: params.limit ?? 25,
      p_offset: params.offset ?? 0,
      p_sort_field: params.sortField ?? 'asset_name',
      p_sort_dir: params.sortDir ?? 'asc',
    });

    if (error) throw new DefectServiceError(error.message, error.code);

    let rows = (data ?? []) as Array<Record<string, unknown>>;

    // Client-side filter by turbine ID if provided
    if (params.turbineId) {
      rows = rows.filter((row) => row.turbine_id === params.turbineId);
    }

    const totalCount = rows.length;

    return {
      data: rows.map(mapToDefectDashboardRow),
      totalCount,
    };
  },

  /**
   * Get comments for a specific defect.
   */
  async getDefectComments(defectId: string): Promise<DefectComment[]> {
    const { data, error } = await db
      .from('defect_comment')
      .select('*, author:profiles(name)')
      .eq('defect_id', defectId)
      .order('created_at', { ascending: false });

    if (error) throw new DefectServiceError(error.message, error.code);

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      defectId: row.defect_id as string,
      authorId: row.author_id as string,
      authorName: (row.author as Record<string, unknown>)?.name as string ?? 'Unknown',
      text: row.text as string,
      createdAt: row.created_at as string,
    }));
  },

  /**
   * Add a comment to a defect.
   */
  async addDefectComment(defectId: string, text: string): Promise<DefectComment> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new DefectServiceError('Not authenticated');

    const { data, error } = await db
      .from('defect_comment')
      .insert({ defect_id: defectId, text, author_id: user.id })
      .select('id, defect_id, author_id, text, created_at')
      .single();

    if (error) throw new DefectServiceError(error.message, error.code);

    const row = data as Record<string, unknown>;
    return {
      id: row.id as string,
      defectId: row.defect_id as string,
      authorId: row.author_id as string,
      authorName: user.email?.split('@')[0] ?? 'You',
      text: row.text as string,
      createdAt: row.created_at as string,
    };
  },

  /**
   * Delete comments matching specific text for a defect.
   */
  async deleteDefectCommentByText(defectId: string, text: string): Promise<void> {
    const { error } = await db
      .from('defect_comment')
      .delete()
      .eq('defect_id', defectId)
      .eq('text', text);

    if (error) throw new DefectServiceError(error.message, error.code);
  },

  /**
   * Toggle the resolved status of a defect.
   */
  async toggleDefectResolved(id: string, resolved: boolean): Promise<void> {
    const { error } = await db.rpc('toggle_defect_resolved', {
      p_defect_id: id,
      p_resolved: resolved,
    });

    if (error) throw new DefectServiceError(error.message, error.code);
  },

  /**
   * Delete a defect by ID (uses typed client).
   */
  async deleteDefectById(id: string): Promise<void> {
    const { error } = await db
      .from('defect')
      .delete()
      .eq('id', id);

    if (error) throw new DefectServiceError(error.message, error.code);
  },

  /**
   * Update defect fields from dashboard editor.
   */
  async updateDefectFields(id: string, data: {
    type?: string;
    category?: number;
    rootDistance?: number;
    side?: string;
    notes?: string;
    rootCause?: string;
    nextStep?: string;
  }): Promise<void> {
    // Map display labels back to DB enum values
    const typeKey = Object.entries(DEFECT_TYPE_DISPLAY_LABELS).find(
      ([, label]) => label === data.type
    )?.[0] ?? data.type?.toLowerCase().replace(/\s+/g, '_');

    const updatePayload: Record<string, unknown> = {};
    if (data.type !== undefined) updatePayload.type = typeKey;
    if (data.category !== undefined) updatePayload.severity = data.category;
    if (data.rootDistance !== undefined) updatePayload.distance_from_root = data.rootDistance;
    if (data.side !== undefined) updatePayload.side = data.side;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.rootCause !== undefined) updatePayload.root_cause = data.rootCause;
    if (data.nextStep !== undefined) updatePayload.next_step = data.nextStep;

    const { error } = await db
      .from('defect')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw new DefectServiceError(error.message, error.code);
  },

  /**
   * Export all defects matching the search as a list (no pagination limit).
   */
  async exportDefectsList(params: { search?: string }): Promise<DefectDashboardRow[]> {
    const result = await this.listDefectsDashboard({
      search: params.search,
      limit: 10000,
      offset: 0,
    });
    return result.data;
  },

  /**
   * List defects for a specific turbine (via blade → inspection → defect).
   */
  async listDefectsByTurbine(turbineId: string): Promise<DefectDashboardRow[]> {
    // Get blades for this turbine, then inspections, then defects
    const { data: blades, error: bladeErr } = await supabase
      .from('blade')
      .select('id, position')
      .eq('turbine_id', turbineId);
    if (bladeErr || !blades || blades.length === 0) return [];

    const bladeIds = blades.map((b: { id: string }) => b.id);

    // Get inspections for these blades
    const { data: inspections, error: inspErr } = await supabase
      .from('inspection')
      .select('id')
      .in('blade_id', bladeIds);
    if (inspErr || !inspections || inspections.length === 0) return [];

    const inspectionIds = inspections.map((i: { id: string }) => i.id);

    // Get defects for these inspections
    const { data: defects, error: defErr } = await supabase
      .from('defect')
      .select(`
        id,
        type,
        severity,
        distance_from_root,
        description,
        width_cm,
        height_cm,
        side,
        notes,
        root_cause,
        next_step,
        resolved,
        inspection_id,
        inspection:inspection!inner(
          blade_id,
          blade:blade!inner(
            position,
            turbine:turbine!inner(
              name,
              model,
              wind_farm:wind_farm!inner(name)
            )
          )
        )
      `)
      .in('inspection_id', inspectionIds)
      .order('distance_from_root', { ascending: true });
    if (defErr) return [];

    return ((defects as unknown[]) ?? []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const inspection = r.inspection as Record<string, unknown> | null;
      const blade = inspection?.blade as Record<string, unknown> | null;
      const turbine = blade?.turbine as Record<string, unknown> | null;
      const windFarm = turbine?.wind_farm as Record<string, unknown> | null;
      const bladePos = Number(blade?.position) || 1;

      const severity = Number(r.severity) || 3;
      let actionText = 'Monitor';
      let actionUrgency: 'high' | 'medium' | 'low' = 'low';
      if (severity >= 4) { actionText = 'Repair'; actionUrgency = 'high'; }
      else if (severity === 3) { actionText = 'Monitor closely'; actionUrgency = 'medium'; }

      return {
        id: r.id as string,
        assetName: (windFarm?.name as string) ?? '',
        turbineName: (turbine?.name as string) ?? '',
        turbineModel: (turbine?.model as string) ?? '',
        type: DEFECT_TYPE_DISPLAY_LABELS[(r.type as string) ?? ''] ?? (r.type as string) ?? '',
        defectWidth: Number(r.width_cm) || 0,
        defectHeight: Number(r.height_cm) || 0,
        category: severity,
        actionText,
        actionUrgency,
        nextStep: (r.next_step as string) ?? '',
        bladePosition: BLADE_POSITION_LABELS[bladePos] ?? String(bladePos),
        side: (r.side as string) ?? 'LE',
        rootDistance: Number(r.distance_from_root) || 0,
        rootCause: (r.root_cause as string) ?? null,
        notes: (r.notes as string) ?? null,
        imageUrl: getDefectImageByType((r.type as string) ?? "other"),
        resolved: Boolean(r.resolved),
        inspectionId: r.inspection_id as string,
        bladeId: (inspection?.blade_id as string) ?? '',
      } as DefectDashboardRow;
    });
  },

  /**
   * List defects for all turbines in a wind farm.
   */
  async listDefectsByWindFarm(windFarmId: string): Promise<DefectDashboardRow[]> {
    // Get all turbines for this wind farm
    const { data: turbines, error: turbErr } = await supabase
      .from('turbine')
      .select('id')
      .eq('wind_farm_id', windFarmId);
    if (turbErr || !turbines || turbines.length === 0) return [];

    const turbineIds = turbines.map((t: { id: string }) => t.id);

    // Get all blades for these turbines
    const { data: blades, error: bladeErr } = await supabase
      .from('blade')
      .select('id')
      .in('turbine_id', turbineIds);
    if (bladeErr || !blades || blades.length === 0) return [];

    const bladeIds = blades.map((b: { id: string }) => b.id);

    // Get inspections for these blades
    const { data: inspections, error: inspErr } = await supabase
      .from('inspection')
      .select('id')
      .in('blade_id', bladeIds);
    if (inspErr || !inspections || inspections.length === 0) return [];

    const inspectionIds = inspections.map((i: { id: string }) => i.id);

    // Get defects for these inspections
    const { data: defects, error: defErr } = await supabase
      .from('defect')
      .select(`
        id,
        type,
        severity,
        distance_from_root,
        description,
        width_cm,
        height_cm,
        side,
        notes,
        root_cause,
        next_step,
        resolved,
        inspection_id,
        inspection:inspection!inner(
          blade_id,
          blade:blade!inner(
            position,
            turbine:turbine!inner(
              name,
              model,
              wind_farm:wind_farm!inner(name)
            )
          )
        )
      `)
      .in('inspection_id', inspectionIds)
      .order('distance_from_root', { ascending: true });
    if (defErr) return [];

    return ((defects as unknown[]) ?? []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const inspection = r.inspection as Record<string, unknown> | null;
      const blade = inspection?.blade as Record<string, unknown> | null;
      const turbine = blade?.turbine as Record<string, unknown> | null;
      const windFarm = turbine?.wind_farm as Record<string, unknown> | null;
      const bladePos = Number(blade?.position) || 1;

      const severity = Number(r.severity) || 3;
      let actionText = 'Monitor';
      let actionUrgency: 'high' | 'medium' | 'low' = 'low';
      if (severity >= 4) { actionText = 'Repair'; actionUrgency = 'high'; }
      else if (severity === 3) { actionText = 'Monitor closely'; actionUrgency = 'medium'; }

      return {
        id: r.id as string,
        assetName: (windFarm?.name as string) ?? '',
        turbineName: (turbine?.name as string) ?? '',
        turbineModel: (turbine?.model as string) ?? '',
        type: DEFECT_TYPE_DISPLAY_LABELS[(r.type as string) ?? ''] ?? (r.type as string) ?? '',
        defectWidth: Number(r.width_cm) || 0,
        defectHeight: Number(r.height_cm) || 0,
        category: severity,
        actionText,
        actionUrgency,
        nextStep: (r.next_step as string) ?? '',
        bladePosition: BLADE_POSITION_LABELS[bladePos] ?? String(bladePos),
        side: (r.side as string) ?? 'LE',
        rootDistance: Number(r.distance_from_root) || 0,
        rootCause: (r.root_cause as string) ?? null,
        notes: (r.notes as string) ?? null,
        imageUrl: getDefectImageByType((r.type as string) ?? "other"),
        resolved: Boolean(r.resolved),
        inspectionId: r.inspection_id as string,
        bladeId: (inspection?.blade_id as string) ?? '',
      } as DefectDashboardRow;
    });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapToDefectDashboardRow(row: Record<string, unknown>): DefectDashboardRow {
  const bladePos = Number(row.blade_position) || 1;
  return {
    id: row.id as string,
    assetName: (row.asset_name as string) ?? '',
    turbineName: (row.turbine_name as string) ?? '',
    turbineModel: (row.turbine_model as string) ?? '',
    type: DEFECT_TYPE_DISPLAY_LABELS[(row.defect_type as string) ?? ''] ?? (row.defect_type as string) ?? '',
    defectWidth: Number(row.width_cm) || 0,
    defectHeight: Number(row.height_cm) || 0,
    category: Number(row.category) || 3,
    actionText: (row.action_text as string) ?? '',
    actionUrgency: (row.action_urgency as 'high' | 'medium' | 'low') ?? 'medium',
    nextStep: (row.next_step as string) ?? '',
    bladePosition: BLADE_POSITION_LABELS[bladePos] ?? String(bladePos),
    side: (row.side as string) ?? 'LE',
    rootDistance: Number(row.root_distance) || 0,
    rootCause: (row.root_cause as string) ?? null,
    notes: (row.notes as string) ?? null,
    imageUrl: getDefectImageByType((row.defect_type as string) ?? 'other'),
    resolved: Boolean(row.resolved),
    inspectionId: (row.inspection_id as string) ?? '',
    bladeId: (row.blade_id as string) ?? '',
  };
}
