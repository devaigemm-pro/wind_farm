-- Add root_cause and next_step columns to annotation table
ALTER TABLE public.annotation ADD COLUMN IF NOT EXISTS root_cause TEXT DEFAULT '';
ALTER TABLE public.annotation ADD COLUMN IF NOT EXISTS next_step TEXT DEFAULT '';
