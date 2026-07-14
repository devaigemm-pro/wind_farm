import { supabase } from '@/lib/supabase';
import type { Inspection, InspectionStatus } from '@/types';

export interface BladeHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: InspectionStatus;
  severity?: number;
}

export const historyService = {
  async getBladeHistory(
    bladeId: string,
    filters?: BladeHistoryFilters,
  ): Promise<Inspection[]> {
    let query = supabase
      .from('inspection')
      .select('*, defects:defect(severity)')
      .eq('blade_id', bladeId)
      .order('scheduled_date', { ascending: false });

    if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by severity client-side since it lives on a related table
    if (filters?.severity) {
      return (data as unknown as Inspection[]).filter((insp) =>
        insp.defects?.some((d: { severity: number }) => d.severity === filters.severity),
      );
    }

    return data as unknown as Inspection[];
  },

  async globalSearch(
    query: string,
  ): Promise<{ assets: { id: string; name: string }[]; inspections: { id: string; scheduled_date: string; status: string }[] }> {
    if (!query.trim()) return { assets: [], inspections: [] };

    const [farms, inspections] = await Promise.all([
      supabase
        .from('wind_farm')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .limit(5),
      supabase
        .from('inspection')
        .select('id, scheduled_date, status')
        .limit(5),
    ]);

    return {
      assets: (farms.data ?? []) as { id: string; name: string }[],
      inspections: (inspections.data ?? []) as { id: string; scheduled_date: string; status: string }[],
    };
  },
};
