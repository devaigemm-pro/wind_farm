import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface AnnotationType {
  id: string;
  name: string;
  displayOrder: number;
}

export function useAnnotationTypes() {
  return useQuery({
    queryKey: ['annotation-types'],
    queryFn: async (): Promise<AnnotationType[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('annotation_type')
        .select('id, name, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        displayOrder: row.display_order as number,
      }));
    },
    staleTime: 1000 * 60 * 30, // 30 min cache — types rarely change
  });
}
