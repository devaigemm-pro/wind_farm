-- Create annotation_comment table for defect comments in TurbineDetail
CREATE TABLE IF NOT EXISTS public.annotation_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Inspector',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annotation_comment_annotation_id ON public.annotation_comment(annotation_id);

ALTER TABLE public.annotation_comment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read annotation comments"
  ON public.annotation_comment FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert annotation comments"
  ON public.annotation_comment FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete annotation comments"
  ON public.annotation_comment FOR DELETE TO authenticated USING (true);
