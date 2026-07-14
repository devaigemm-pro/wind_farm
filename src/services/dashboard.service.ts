import { supabase } from '@/lib/supabase';

export interface DashboardFilters {
  types?: string[];
  farms?: string[];
  severity?: number;
}

export const dashboardService = {
  async getChartData(chart: string, filters?: DashboardFilters) {
    const { data, error } = await supabase.functions.invoke('dashboard-aggregate', {
      body: { chart, filters },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.data;
  },
};
