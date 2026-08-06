import { supabase } from '@/lib/supabase';
import type { Report, InspectionReportRow } from '@/types';

export const reportsService = {
  /**
   * List finalized inspections with asset/subasset/defects data
   * for the Reports page (Skyvisor-style).
   */
  async listFinalizedInspections(): Promise<InspectionReportRow[]> {
    // Get all finalized inspections with their blade → turbine → wind_farm relations
    const { data: inspections, error: inspError } = await supabase
      .from('inspection')
      .select(`
        id,
        scheduled_date,
        completed_at,
        stage,
        blade:blade_id (
          id,
          position,
          turbine:turbine_id (
            id,
            name,
            wind_farm:wind_farm_id (
              id,
              name
            )
          )
        )
      `)
      .eq('stage', 'finalized')
      .order('completed_at', { ascending: false });

    if (inspError) throw inspError;
    if (!inspections || inspections.length === 0) return [];

    // Get defect counts per inspection in one query
    const inspectionIds = inspections.map((i) => i.id);
    const { data: defects, error: defError } = await supabase
      .from('defect')
      .select('inspection_id')
      .in('inspection_id', inspectionIds);

    if (defError) throw defError;

    // Count defects per inspection
    const defectCounts: Record<string, number> = {};
    for (const d of defects || []) {
      defectCounts[d.inspection_id] = (defectCounts[d.inspection_id] || 0) + 1;
    }

    // Get reports (PDFs) linked to these inspections
    const { data: reports, error: repError } = await supabase
      .from('report')
      .select('reference_id, storage_path')
      .in('reference_id', inspectionIds);

    if (repError) throw repError;

    // Map report storage paths by inspection id
    const reportPaths: Record<string, string> = {};
    for (const r of reports || []) {
      reportPaths[r.reference_id] = r.storage_path;
    }

    // Build result rows
    return inspections.map((insp) => {
      const blade = insp.blade as any;
      const turbine = blade?.turbine;
      const windFarm = turbine?.wind_farm;

      return {
        id: insp.id,
        inspectionDate: insp.completed_at || insp.scheduled_date,
        asset: windFarm?.name || 'Unknown',
        assetId: windFarm?.id || '',
        subAsset: turbine?.name || 'Unknown',
        subAssetId: turbine?.id || '',
        type: 'Blades',
        defectsCount: defectCounts[insp.id] || 0,
        note: null, // No note field in current schema
        pdfStoragePath: reportPaths[insp.id] || null,
      };
    });
  },

  /** Legacy: list generated reports */
  async listReports(): Promise<Report[]> {
    const { data, error } = await supabase
      .from('report')
      .select('*')
      .order('generated_at', { ascending: false });
    if (error) throw error;
    return data as Report[];
  },

  async generateInspectionReport(inspectionId: string) {
    const { data, error } = await supabase.functions.invoke('generate-report', {
      body: { inspectionId },
    });
    if (error) throw error;
    return data;
  },

  async generateFilteredReport(
    inspectionId: string,
    filters: {
      language: string;
      includeDetails: boolean;
      resolvedFilter: 'all' | 'resolved' | 'unresolved';
      categories: number[];
      types: string[];
    },
  ) {
    const { data, error } = await supabase.functions.invoke('generate-report', {
      body: { inspectionId, filters },
    });
    if (error) throw error;
    return data;
  },

  async generateConsolidatedReport(windFarmId: string) {
    const { data, error } = await supabase.functions.invoke('generate-consolidated-report', {
      body: { windFarmId },
    });
    if (error) throw error;
    return data;
  },

  getDownloadUrl(storagePath: string): string {
    const { data } = supabase.storage.from('reports').getPublicUrl(storagePath);
    return data.publicUrl;
  },
};
