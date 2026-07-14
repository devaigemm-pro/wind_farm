import { supabase } from '@/lib/supabase';
import type { Defect, DefectType, Severity } from '@/types';

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
};
