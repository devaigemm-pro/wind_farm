import { supabase } from '@/lib/supabase';
import type { Report } from '@/types';

export const reportsService = {
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
