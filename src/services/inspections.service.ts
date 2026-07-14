import { supabase } from '@/lib/supabase';
import type { Inspection, InspectionStatus, InspectionStage } from '@/types';

// ─── Custom Error ───────────────────────────────────────────────────────────

export class InspectionServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'InspectionServiceError';
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InspectionFilters {
  status?: InspectionStatus;
  stage?: InspectionStage;
  bladeId?: string;
  inspectorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const inspectionsService = {
  /**
   * List inspections with optional filters and pagination.
   * Joins blade → turbine → wind_farm for context display.
   */
  async getInspections(
    filters?: InspectionFilters,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResult<Inspection>> {
    let query = supabase
      .from('inspection')
      .select(
        `
        *,
        blade:blade!inspection_blade_id_fkey(
          id, position, serial_number,
          turbine:turbine!blade_turbine_id_fkey(
            id, name,
            wind_farm:wind_farm!turbine_wind_farm_id_fkey(id, name)
          )
        ),
        inspector:profiles!inspection_inspector_id_fkey(id, name, email)
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.stage) {
      query = query.eq('stage', filters.stage);
    }
    if (filters?.bladeId) {
      query = query.eq('blade_id', filters.bladeId);
    }
    if (filters?.inspectorId) {
      query = query.eq('inspector_id', filters.inspectorId);
    }
    if (filters?.dateFrom) {
      query = query.gte('scheduled_date', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('scheduled_date', filters.dateTo);
    }

    // Paginate
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new InspectionServiceError(error.message, error.code);

    return {
      data: data as unknown as Inspection[],
      count: count ?? 0,
      page,
      pageSize,
    };
  },

  /**
   * Get a single inspection with full related data including
   * blade hierarchy, inspector profile, evidence count, and defect count.
   */
  async getInspection(id: string): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspection')
      .select(
        `
        *,
        blade:blade!inspection_blade_id_fkey(
          *,
          turbine:turbine!blade_turbine_id_fkey(
            *,
            wind_farm:wind_farm!turbine_wind_farm_id_fkey(*)
          )
        ),
        inspector:profiles!inspection_inspector_id_fkey(id, name, email, role),
        approved_by_profile:profiles!inspection_approved_by_fkey(id, name, email, role),
        evidence(*),
        defects:defect(*)
      `,
      )
      .eq('id', id)
      .single();

    if (error) throw new InspectionServiceError(error.message, error.code);
    return data as unknown as Inspection;
  },

  /**
   * Create a new inspection for the current authenticated user.
   * The inspector_id is set from the current auth session.
   */
  async createInspection(input: {
    blade_id: string;
    scheduled_date: string;
  }): Promise<Inspection> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new InspectionServiceError('User must be authenticated to create an inspection');
    }

    const { data, error } = await supabase
      .from('inspection')
      .insert({
        blade_id: input.blade_id,
        scheduled_date: input.scheduled_date,
        inspector_id: user.id,
      })
      .select()
      .single();

    if (error) throw new InspectionServiceError(error.message, error.code);
    return data as unknown as Inspection;
  },

  /**
   * Update basic inspection fields (stage, scheduled_date).
   * Status transitions are handled by dedicated edge functions.
   */
  async updateInspection(
    id: string,
    input: Partial<{ stage: InspectionStage; scheduled_date: string }>,
  ): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspection')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InspectionServiceError(error.message, error.code);
    return data as unknown as Inspection;
  },
};
