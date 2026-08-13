-- Migrate inspection stages: old (to_plan, planned, uploaded, annotated, analyzed, finalized) → new (planned, inspect, annotate, analyze, report)

-- Step 1: Update existing data to new stage values
UPDATE public.inspection SET stage = 'inspect' WHERE stage = 'uploaded';
UPDATE public.inspection SET stage = 'annotate' WHERE stage = 'annotated';
UPDATE public.inspection SET stage = 'analyze' WHERE stage = 'analyzed';
UPDATE public.inspection SET stage = 'report' WHERE stage = 'finalized';
UPDATE public.inspection SET stage = 'planned' WHERE stage = 'to_plan';

-- Step 2: Set correct stage based on actual data
UPDATE public.inspection i SET stage = 'report'
WHERE EXISTS (SELECT 1 FROM report r WHERE r.reference_id = i.id);

UPDATE public.inspection i SET stage = 'analyze'
WHERE EXISTS (SELECT 1 FROM defect d WHERE d.inspection_id = i.id)
AND NOT EXISTS (SELECT 1 FROM report r WHERE r.reference_id = i.id);

UPDATE public.inspection i SET stage = 'annotate'
WHERE EXISTS (SELECT 1 FROM annotation a WHERE a.inspection_id = i.id)
AND NOT EXISTS (SELECT 1 FROM defect d WHERE d.inspection_id = i.id)
AND NOT EXISTS (SELECT 1 FROM report r WHERE r.reference_id = i.id);

UPDATE public.inspection i SET stage = 'inspect'
WHERE EXISTS (SELECT 1 FROM evidence e WHERE e.inspection_id = i.id)
AND NOT EXISTS (SELECT 1 FROM annotation a WHERE a.inspection_id = i.id)
AND NOT EXISTS (SELECT 1 FROM defect d WHERE d.inspection_id = i.id)
AND NOT EXISTS (SELECT 1 FROM report r WHERE r.reference_id = i.id);

-- Step 3: Drop old constraint and add new one
ALTER TABLE public.inspection DROP CONSTRAINT IF EXISTS inspection_stage_check;
ALTER TABLE public.inspection ADD CONSTRAINT inspection_stage_check CHECK (stage IN ('planned', 'inspect', 'annotate', 'analyze', 'report'));

-- Step 4: Update default value
ALTER TABLE public.inspection ALTER COLUMN stage SET DEFAULT 'planned';
