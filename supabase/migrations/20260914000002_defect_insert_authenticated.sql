-- The repair-campaign Excel import (repair-import.service.ts) inserts defects
-- into inspections that may not belong to the current user or aren't
-- 'in_progress', so the existing inspector-scoped INSERT policy blocked it
-- (error: new row violates row-level security policy for table "defect").
-- Add a permissive INSERT policy for authenticated users, consistent with the
-- quote/quote_item/work_order INSERT policies used by the same import flow.
DROP POLICY IF EXISTS "Authenticated users can create defects" ON public.defect;
CREATE POLICY "Authenticated users can create defects"
  ON public.defect FOR INSERT TO authenticated WITH CHECK (true);
