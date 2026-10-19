-- Add per-repair progress tracking fields edited from the web Repair Workflow:
--   start_category         → "Categoría de inicio" (defect severity 1-5)
--   final_category         → "Categoría final" (defect severity 1-5)
--   assigned_technician_id → "Técnico a cargo" (profiles.id, role='technician')
--   progress_percent       → "% de avance" (0-100)
-- All nullable: they are optional and filled progressively from the web.
ALTER TABLE repair
  ADD COLUMN IF NOT EXISTS start_category integer,
  ADD COLUMN IF NOT EXISTS final_category integer,
  ADD COLUMN IF NOT EXISTS assigned_technician_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS progress_percent integer;
