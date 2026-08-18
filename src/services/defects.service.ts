import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type { Defect, DefectType, Severity, DefectDashboardRow, DefectComment } from '@/types';
import { BLADE_POSITION_LABELS, DEFECT_TYPE_DISPLAY_LABELS } from '@/types';

// ─── Fetch real photos for defects via annotation → inspection_photo ─────────

export interface DefectImageData {
  url: string;
  annotX?: number;
  annotY?: number;
  annotW?: number;
  annotH?: number;
  annotAngle?: number;
}

export async function fetchDefectImageMap(defectIds: string[]): Promise<Record<string, DefectImageData>> {
  if (defectIds.length === 0) return {};

  // Get defects with their description (annotation ID)
  const { data: defects } = await supabase
    .from('defect')
    .select('id, description')
    .in('id', defectIds);

  if (!defects || defects.length === 0) return {};

  // Filter defects that have an annotation ID in description
  const annotationIds = defects
    .map((d) => d.description)
    .filter((desc): desc is string => !!desc && desc.length === 36);

  if (annotationIds.length === 0) return {};

  // Get annotations with their thumbnail_id AND coordinates
  const { data: annotations } = await supabase
    .from('annotation')
    .select('id, thumbnail_id, x, y, w, h, angle')
    .in('id', annotationIds);

  if (!annotations || annotations.length === 0) return {};

  // Get inspection_photos for the thumbnail IDs
  const thumbnailIds = [...new Set(annotations.map((a) => a.thumbnail_id).filter(Boolean))];
  if (thumbnailIds.length === 0) return {};

  const { data: photos } = await db
    .from('inspection_photo')
    .select('id, storage_path')
    .in('id', thumbnailIds);

  if (!photos || photos.length === 0) return {};

  // Generate signed URLs for the photos (bucket is private)
  const storagePaths = (photos as Array<{ id: string; storage_path: string }>)
    .filter((p) => p.storage_path)
    .map((p) => p.storage_path);

  const { data: signedResult } = await supabase.storage
    .from('asset-documents')
    .createSignedUrls(storagePaths, 3600);

  // Build storage_path → signed URL map
  const pathToUrl: Record<string, string> = {};
  if (signedResult) {
    for (const item of signedResult) {
      if (item.signedUrl && !item.error) {
        pathToUrl[item.path ?? ''] = item.signedUrl;
      }
    }
  }

  // Build thumbnail_id → signed URL map
  const photoUrlMap: Record<string, string> = {};
  for (const photo of (photos as Array<{ id: string; storage_path: string }>)) {
    if (photo.storage_path && pathToUrl[photo.storage_path]) {
      photoUrlMap[photo.id] = pathToUrl[photo.storage_path]!;
    }
  }

  // Build annotation_id → {url, coords} map
  const annotationDataMap: Record<string, DefectImageData> = {};
  for (const ann of annotations) {
    if (ann.thumbnail_id && photoUrlMap[ann.thumbnail_id]) {
      annotationDataMap[ann.id] = {
        url: photoUrlMap[ann.thumbnail_id]!,
        annotX: ann.x != null ? Number(ann.x) : undefined,
        annotY: ann.y != null ? Number(ann.y) : undefined,
        annotW: ann.w != null ? Number(ann.w) : undefined,
        annotH: ann.h != null ? Number(ann.h) : undefined,
        annotAngle: ann.angle != null ? Number(ann.angle) : undefined,
      };
    }
  }

  // Build defect_id → DefectImageData map
  const result: Record<string, DefectImageData> = {};
  for (const d of defects) {
    if (d.description && annotationDataMap[d.description]) {
      result[d.id] = annotationDataMap[d.description]!;
    }
  }

  return result;
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
    width_cm?: number;
    height_cm?: number;
    next_step?: string;
  }): Promise<Defect> {
    const { data, error } = await supabase
      .from('defect')
      .insert({
        inspection_id: input.inspection_id,
        type: input.type,
        severity: input.severity,
        distance_from_root: input.distance_from_root,
        description: input.description ?? null,
        width_cm: input.width_cm ?? 0,
        height_cm: input.height_cm ?? 0,
        next_step: input.next_step ?? null,
      })
      .select()
      .single();

    if (error) throw new DefectServiceError(error.message, error.code);

    // Transition inspection stage to 'analyze' if this is the first defect
    try {
      const { count } = await supabase
        .from('defect')
        .select('id', { count: 'exact', head: true })
        .eq('inspection_id', input.inspection_id);

      if (count === 1) {
        await supabase
          .from('inspection')
          .update({ stage: 'analyze' })
          .eq('id', input.inspection_id)
          .in('stage', ['planned', 'inspect', 'annotate']);
      }
    } catch (stageError) {
      console.error('[defects.service] Failed to update inspection stage:', stageError);
    }

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
      width_cm: number;
      height_cm: number;
      next_step: string;
    }>,
  ): Promise<Defect> {
    const updatePayload: Record<string, unknown> = {};
    if (input.type !== undefined) updatePayload.type = input.type;
    if (input.severity !== undefined) updatePayload.severity = input.severity;
    if (input.distance_from_root !== undefined) updatePayload.distance_from_root = input.distance_from_root;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.width_cm !== undefined) updatePayload.width_cm = input.width_cm;
    if (input.height_cm !== undefined) updatePayload.height_cm = input.height_cm;
    if (input.next_step !== undefined) updatePayload.next_step = input.next_step;

    const { data, error } = await supabase
      .from('defect')
      .update(updatePayload as never)
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
    // Query all defects with both blade and direct turbine paths (no broken INNER JOIN)
    const { data: defects, error } = await supabase
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
        action_text,
        action_urgency,
        inspection_id,
        inspection:inspection!inner(
          blade_id,
          turbine_id,
          blade:blade(
            position,
            turbine:turbine!blade_turbine_id_fkey(
              id,
              name,
              model,
              wind_farm:wind_farm!turbine_wind_farm_id_fkey(name)
            )
          ),
          direct_turbine:turbine!inspection_turbine_id_fkey(
            id,
            name,
            model,
            wind_farm:wind_farm!turbine_wind_farm_id_fkey(name)
          )
        )
      `)
      .order('distance_from_root', { ascending: true });

    if (error) throw new DefectServiceError(error.message, error.code);

    let rows = ((defects as unknown[]) ?? []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const inspection = r.inspection as Record<string, unknown> | null;
      const blade = inspection?.blade as Record<string, unknown> | null;
      const turbineViaBlade = blade?.turbine as Record<string, unknown> | null;
      const directTurbine = inspection?.direct_turbine as Record<string, unknown> | null;
      const turbine = turbineViaBlade ?? directTurbine;
      const windFarm = (turbine?.wind_farm as Record<string, unknown>) ?? null;
      const bladePos = Number(blade?.position) || 0;

      const severity = Number(r.severity) || 3;
      let actionText = (r.action_text as string) ?? '';
      let actionUrgency = (r.action_urgency as string) ?? 'medium';
      if (!actionText) {
        if (severity >= 4) { actionText = 'Repair'; actionUrgency = 'high'; }
        else if (severity === 3) { actionText = 'Monitor closely'; actionUrgency = 'medium'; }
        else { actionText = 'Monitor'; actionUrgency = 'low'; }
      }

      return {
        id: r.id as string,
        assetName: (windFarm?.name as string) ?? '',
        turbineName: (turbine?.name as string) ?? '',
        turbineModel: (turbine?.model as string) ?? '',
        turbineId: (turbine?.id as string) ?? '',
        type: DEFECT_TYPE_DISPLAY_LABELS[(r.type as string) ?? ''] ?? (r.type as string) ?? '',
        defectWidth: Number(r.width_cm) || 0,
        defectHeight: Number(r.height_cm) || 0,
        category: severity,
        actionText,
        actionUrgency: actionUrgency as 'high' | 'medium' | 'low',
        nextStep: (r.next_step as string) ?? '',
        bladePosition: BLADE_POSITION_LABELS[bladePos] ?? String(bladePos),
        side: (r.side as string) ?? 'LE',
        rootDistance: Number(r.distance_from_root) || 0,
        rootCause: (r.root_cause as string) ?? null,
        notes: (r.notes as string) ?? null,
        imageUrl: null as string | null,
        resolved: Boolean(r.resolved),
        inspectionId: (r.inspection_id as string) ?? '',
        bladeId: (inspection?.blade_id as string) ?? '',
      };
    });

    // Filter: must have at least a turbine resolved
    rows = rows.filter(r => r.turbineName !== '');

    // Client-side filter by turbine ID if provided
    if (params.turbineId) {
      rows = rows.filter((row) => row.turbineId === params.turbineId);
    }

    // Client-side search
    const search = (params.search ?? '').toLowerCase();
    if (search) {
      rows = rows.filter(r =>
        r.assetName.toLowerCase().includes(search) ||
        r.turbineName.toLowerCase().includes(search) ||
        r.turbineModel.toLowerCase().includes(search) ||
        r.type.toLowerCase().includes(search)
      );
    }

    // Client-side sorting
    const sortField = params.sortField ?? 'asset_name';
    const sortDir = params.sortDir ?? 'asc';
    const fieldMap: Record<string, keyof typeof rows[0]> = {
      asset_name: 'assetName',
      turbine_name: 'turbineName',
      turbine_model: 'turbineModel',
      type: 'type',
      next_step: 'nextStep',
      side: 'side',
      category: 'category',
      root_distance: 'rootDistance',
      blade: 'bladePosition',
      resolved: 'resolved',
    };
    const key = fieldMap[sortField] ?? 'assetName';
    rows.sort((a, b) => {
      const aVal = a[key] ?? '';
      const bVal = b[key] ?? '';
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const totalCount = rows.length;

    // Pagination
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 25;
    const paginatedRows = rows.slice(offset, offset + limit);

    // Fetch real evidence images for these defects
    const defectIds = paginatedRows.map((r) => r.id);
    const imageMap = await fetchDefectImageMap(defectIds);

    return {
      data: paginatedRows.map(r => {
        const imgData = imageMap[r.id];
        return {
          ...r,
          imageUrl: imgData?.url ?? null,
          annotX: imgData?.annotX,
          annotY: imgData?.annotY,
          annotW: imgData?.annotW,
          annotH: imgData?.annotH,
          annotAngle: imgData?.annotAngle,
        };
      }) as DefectDashboardRow[],
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
    // Get blades for this turbine
    const { data: blades, error: bladeErr } = await supabase
      .from('blade')
      .select('id, position')
      .eq('turbine_id', turbineId);

    const bladeIds = (!bladeErr && blades) ? blades.map((b: { id: string }) => b.id) : [];

    // Path 1: inspections via blade_id
    const { data: bladeInspections } = bladeIds.length > 0
      ? await supabase.from('inspection').select('id').in('blade_id', bladeIds)
      : { data: [] };

    // Path 2: inspections via turbine_id directly
    const { data: turbineInspections } = await supabase
      .from('inspection')
      .select('id')
      .in('turbine_id', [turbineId]);

    // Deduplicate inspection IDs
    const inspIdSet = new Set<string>();
    for (const i of (bladeInspections ?? [])) inspIdSet.add((i as { id: string }).id);
    for (const i of (turbineInspections ?? [])) inspIdSet.add((i as { id: string }).id);
    const inspectionIds = Array.from(inspIdSet);
    if (inspectionIds.length === 0) return [];

    // Get defects for these inspections (join blade optionally, turbine via both paths)
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
          turbine_id,
          blade:blade(
            position,
            turbine:turbine!blade_turbine_id_fkey(
              name,
              model,
              wind_farm:wind_farm!turbine_wind_farm_id_fkey(name)
            )
          ),
          direct_turbine:turbine!inspection_turbine_id_fkey(
            name,
            model,
            wind_farm:wind_farm!turbine_wind_farm_id_fkey(name)
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
      const turbineViaBlade = blade?.turbine as Record<string, unknown> | null;
      const directTurbine = inspection?.direct_turbine as Record<string, unknown> | null;
      const turbine = turbineViaBlade ?? directTurbine;
      const windFarm = (turbine?.wind_farm as Record<string, unknown>) ?? null;
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
        imageUrl: null,
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

    // Get inspections via both paths: blade_id and turbine_id
    const { data: blades, error: bladeErr } = await supabase
      .from('blade')
      .select('id')
      .in('turbine_id', turbineIds);

    const bladeIds = (!bladeErr && blades) ? blades.map((b: { id: string }) => b.id) : [];

    // Path 1: inspections via blade_id
    const { data: bladeInspections } = bladeIds.length > 0
      ? await supabase.from('inspection').select('id').in('blade_id', bladeIds)
      : { data: [] };

    // Path 2: inspections via turbine_id directly
    const { data: turbineInspections } = await supabase
      .from('inspection')
      .select('id')
      .in('turbine_id', turbineIds);

    // Deduplicate inspection IDs
    const inspIdSet = new Set<string>();
    for (const i of (bladeInspections ?? [])) inspIdSet.add((i as { id: string }).id);
    for (const i of (turbineInspections ?? [])) inspIdSet.add((i as { id: string }).id);
    const inspectionIds = Array.from(inspIdSet);
    if (inspectionIds.length === 0) return [];

    // Get defects for these inspections (join blade optionally, turbine via both paths)
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
          turbine_id,
          blade:blade(
            position,
            turbine:turbine!blade_turbine_id_fkey(
              name,
              model,
              wind_farm:wind_farm!turbine_wind_farm_id_fkey(name)
            )
          ),
          direct_turbine:turbine!inspection_turbine_id_fkey(
            name,
            model,
            wind_farm:wind_farm!turbine_wind_farm_id_fkey(name)
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
      const turbineViaBlade = blade?.turbine as Record<string, unknown> | null;
      const directTurbine = inspection?.direct_turbine as Record<string, unknown> | null;
      const turbine = turbineViaBlade ?? directTurbine;
      const windFarm = (turbine?.wind_farm as Record<string, unknown>) ?? null;
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
        imageUrl: null,
        resolved: Boolean(r.resolved),
        inspectionId: r.inspection_id as string,
        bladeId: (inspection?.blade_id as string) ?? '',
      } as DefectDashboardRow;
    });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapToDefectDashboardRow(row: Record<string, unknown>, imageUrl: string | null): DefectDashboardRow {
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
    imageUrl: imageUrl ?? null,
    resolved: Boolean(row.resolved),
    inspectionId: (row.inspection_id as string) ?? '',
    bladeId: (row.blade_id as string) ?? '',
  };
}
