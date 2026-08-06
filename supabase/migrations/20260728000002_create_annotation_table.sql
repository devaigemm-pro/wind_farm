-- Migration: Create annotation table for storing image annotations from the Annotate step
CREATE TABLE IF NOT EXISTS public.annotation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspection(id) ON DELETE CASCADE,
  thumbnail_id TEXT NOT NULL,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  w NUMERIC NOT NULL,
  h NUMERIC NOT NULL,
  angle NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  category INT NOT NULL CHECK (category BETWEEN 1 AND 5),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annotation_inspection_id ON public.annotation(inspection_id);
CREATE INDEX IF NOT EXISTS idx_annotation_thumbnail ON public.annotation(inspection_id, thumbnail_id);

-- RLS
ALTER TABLE public.annotation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read annotations"
  ON public.annotation FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create annotations"
  ON public.annotation FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update annotations"
  ON public.annotation FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete annotations"
  ON public.annotation FOR DELETE TO authenticated USING (true);
