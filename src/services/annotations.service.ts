import { supabase } from '@/lib/supabase';

export interface Annotation {
  id: string;
  inspectionId: string;
  thumbnailId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  type: string;
  category: number;
  note: string;
  rootCause: string;
  nextStep: string;
  side: string | null;
  createdAt: string;
}

export interface CreateAnnotationInput {
  inspectionId: string;
  thumbnailId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  type: string;
  category: number;
  note?: string;
  rootCause?: string;
  nextStep?: string;
}

export interface UpdateAnnotationInput {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  angle?: number;
  type?: string;
  category?: number;
  note?: string;
  rootCause?: string;
  nextStep?: string;
  side?: string;
}

function mapRow(row: Record<string, unknown>): Annotation {
  return {
    id: row.id as string,
    inspectionId: row.inspection_id as string,
    thumbnailId: row.thumbnail_id as string,
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.w),
    h: Number(row.h),
    angle: Number(row.angle),
    type: row.type as string,
    category: Number(row.category),
    note: (row.note as string) ?? '',
    rootCause: (row.root_cause as string) ?? '',
    nextStep: (row.next_step as string) ?? '',
    side: (row.side as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export const annotationsService = {
  async list(inspectionId: string): Promise<Annotation[]> {
    const { data, error } = await supabase
      .from('annotation')
      .select('*')
      .eq('inspection_id', inspectionId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((r: unknown) => mapRow(r as Record<string, unknown>));
  },

  async listMultiple(inspectionIds: string[]): Promise<Annotation[]> {
    if (inspectionIds.length === 0) return [];
    const { data, error } = await supabase
      .from('annotation')
      .select('*')
      .in('inspection_id', inspectionIds)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((r: unknown) => mapRow(r as Record<string, unknown>));
  },

  async create(input: CreateAnnotationInput): Promise<Annotation> {
    const insertPayload: Record<string, unknown> = {
      inspection_id: input.inspectionId,
      thumbnail_id: input.thumbnailId,
      x: input.x,
      y: input.y,
      w: input.w,
      h: input.h,
      angle: input.angle ?? 0,
      type: input.type,
      category: input.category,
      note: input.note ?? '',
    };
    // Only add optional columns if they have values (avoids 400 if columns don't exist yet)
    if (input.rootCause) insertPayload.root_cause = input.rootCause;
    if (input.nextStep) insertPayload.next_step = input.nextStep;

    const { data, error } = await supabase
      .from('annotation')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Transition inspection stage to 'annotated' if this is the first annotation
    try {
      const { count } = await supabase
        .from('annotation')
        .select('id', { count: 'exact', head: true })
        .eq('inspection_id', input.inspectionId);

      if (count === 1) {
        await supabase
          .from('inspection')
          .update({ stage: 'annotated' })
          .eq('id', input.inspectionId)
          .in('stage', ['to_plan', 'planned', 'uploaded']);
      }
    } catch (stageError) {
      console.error('[annotations.service] Failed to update inspection stage:', stageError);
    }

    return mapRow(data as Record<string, unknown>);
  },

  async update(id: string, input: UpdateAnnotationInput): Promise<Annotation> {
    const payload: Record<string, unknown> = {};
    if (input.x !== undefined) payload.x = input.x;
    if (input.y !== undefined) payload.y = input.y;
    if (input.w !== undefined) payload.w = input.w;
    if (input.h !== undefined) payload.h = input.h;
    if (input.angle !== undefined) payload.angle = input.angle;
    if (input.type !== undefined) payload.type = input.type;
    if (input.category !== undefined) payload.category = input.category;
    if (input.note !== undefined) payload.note = input.note;
    if (input.rootCause !== undefined) payload.root_cause = input.rootCause;
    if (input.nextStep !== undefined) payload.next_step = input.nextStep;
    if (input.side !== undefined) payload.side = input.side;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('annotation')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(payload as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('annotation')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },
};
