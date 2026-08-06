import { supabase } from '@/lib/supabase';

export interface AnnotationComment {
  id: string;
  annotationId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): AnnotationComment {
  return {
    id: row.id as string,
    annotationId: row.annotation_id as string,
    authorName: (row.author_name as string) ?? 'Inspector',
    text: row.text as string,
    createdAt: row.created_at as string,
  };
}

export const annotationCommentsService = {
  async list(annotationId: string): Promise<AnnotationComment[]> {
    const { data, error } = await supabase
      .from('annotation_comment')
      .select('*')
      .eq('annotation_id', annotationId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((r: unknown) => mapRow(r as Record<string, unknown>));
  },

  async create(annotationId: string, text: string): Promise<AnnotationComment> {
    const { data: { user } } = await supabase.auth.getUser();
    const authorName = user?.email?.split('@')[0] ?? 'Inspector';

    const { data, error } = await supabase
      .from('annotation_comment')
      .insert({ annotation_id: annotationId, text, author_name: authorName })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  },
};
