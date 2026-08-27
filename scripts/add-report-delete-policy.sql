-- Add DELETE and UPDATE RLS policies for the report table.
-- Previously only SELECT and INSERT existed, so deleting a report failed
-- silently (RLS blocked it) — the "delete report" button appeared to do nothing.

CREATE POLICY "Authenticated users can delete reports"
  ON public.report FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can update reports"
  ON public.report FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
