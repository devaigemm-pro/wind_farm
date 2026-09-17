-- External defect identifier coming from the repair-campaign Excel import
-- (column "Identificador Defecto", e.g. "DAÑO 1"). Stored verbatim.
-- It is independent of:
--   - defect_number (computed per-blade correlative A1/A2)
--   - description (used as the annotation UUID link for shared numbering)
ALTER TABLE public.defect ADD COLUMN IF NOT EXISTS defect_identifier text;
