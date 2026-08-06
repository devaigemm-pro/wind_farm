-- Remove the FK constraint on annotation.inspection_id so annotations can be
-- created for mock/demo inspection IDs that don't exist in the inspection table.
ALTER TABLE public.annotation DROP CONSTRAINT IF EXISTS annotation_inspection_id_fkey;
