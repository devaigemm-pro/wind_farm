import { supabase } from '@/lib/supabase';
import type { Report, InspectionReportRow } from '@/types';

export const reportsService = {
  /**
   * List finalized inspections with asset/subasset/defects data
   * for the Reports page (Skyvisor-style).
   */
  async listFinalizedInspections(): Promise<InspectionReportRow[]> {
    // An inspection is considered "finalized/reportable" if EITHER:
    //   (a) it has at least one record in the `report` table, OR
    //   (b) its stage is 'report'.
    // Relying only on stage='report' is fragile: if the stage update fails
    // silently (panel closed early, etc.) the report row exists but the
    // inspection would never show up. So we combine both sources.

    // 1. Collect the distinct reference_ids that already have a report row.
    const { data: reportRefs, error: refsError } = await supabase
      .from('report')
      .select('reference_id');
    if (refsError) throw refsError;

    const idsWithReport = Array.from(
      new Set((reportRefs || []).map((r) => r.reference_id).filter(Boolean)),
    );

    // 2. Fetch inspections that are either stage='report' OR have a report row.
    const inspectionSelect = `
        id,
        scheduled_date,
        completed_at,
        stage,
        turbine:turbine_id (
          id,
          name,
          wind_farm:wind_farm_id (
            id,
            name
          )
        ),
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
      `;

    const baseQuery = supabase.from('inspection').select(inspectionSelect);

    const filteredQuery =
      idsWithReport.length > 0
        ? // stage = 'report' OR id IN (ids that have a report)
          baseQuery.or(
            `stage.eq.report,id.in.(${idsWithReport.map((id) => `"${id}"`).join(',')})`,
          )
        : baseQuery.eq('stage', 'report');

    const { data: inspections, error: inspError } = await filteredQuery.order(
      'completed_at',
      { ascending: false },
    );

    if (inspError) throw inspError;
    if (!inspections || inspections.length === 0) return [];

    // Get annotation counts per inspection (annotations are the source of truth for defects)
    const inspectionIds = inspections.map((i) => i.id);
    let defectCounts: Record<string, number> = {};
    if (inspectionIds.length > 0) {
      const { data: annotations, error: annError } = await supabase
        .from('annotation')
        .select('inspection_id')
        .in('inspection_id', inspectionIds);

      if (!annError && annotations) {
        for (const a of annotations) {
          defectCounts[a.inspection_id] = (defectCounts[a.inspection_id] || 0) + 1;
        }
      }
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
      // Prefer the turbine linked directly to the inspection (turbine_id).
      // Fall back to the turbine reached through the blade relation for
      // inspections created per-blade (blade_id set).
      const turbine = (insp as any).turbine ?? blade?.turbine;
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
