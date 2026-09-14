-- DELETE policies so authenticated users can delete a defect's repair chain
-- from the RepairWorkflow screen (/repairs/:campaignId). RLS DELETE was missing
-- for these tables → the delete failed silently. The quote/quote_item/work_order/
-- defect DELETE policies already existed.
DROP POLICY IF EXISTS "repair_delete" ON public.repair;
CREATE POLICY "repair_delete" ON public.repair FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "repair_stage_delete" ON public.repair_stage;
CREATE POLICY "repair_stage_delete" ON public.repair_stage FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "repair_photo_delete" ON public.repair_photo;
CREATE POLICY "repair_photo_delete" ON public.repair_photo FOR DELETE TO authenticated USING (true);
