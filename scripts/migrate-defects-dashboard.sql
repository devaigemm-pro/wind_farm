-- Migration: defects dashboard support
-- Adds new columns to defect, creates defect_comment table, and RPC function

-- 1. New columns on defect table
ALTER TABLE defect
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS side VARCHAR(2) DEFAULT 'LE',
  ADD COLUMN IF NOT EXISTS action_text TEXT,
  ADD COLUMN IF NOT EXISTS action_urgency VARCHAR(10) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;

-- 2. Constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'defect_side_check'
  ) THEN
    ALTER TABLE defect ADD CONSTRAINT defect_side_check CHECK (side IN ('LE', 'SS', 'TE', 'PS'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'defect_action_urgency_check'
  ) THEN
    ALTER TABLE defect ADD CONSTRAINT defect_action_urgency_check CHECK (action_urgency IN ('high', 'medium', 'low'));
  END IF;
END $$;

-- 3. Add model column to turbine if not exists
ALTER TABLE turbine ADD COLUMN IF NOT EXISTS model TEXT;

-- 4. Defect comments table
CREATE TABLE IF NOT EXISTS defect_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id UUID NOT NULL REFERENCES defect(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defect_comment_defect_id ON defect_comment(defect_id);

-- 5. RLS on defect_comment
ALTER TABLE defect_comment ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read defect comments'
  ) THEN
    CREATE POLICY "Authenticated users can read defect comments"
      ON defect_comment FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert defect comments'
  ) THEN
    CREATE POLICY "Authenticated users can insert defect comments"
      ON defect_comment FOR INSERT TO authenticated
      WITH CHECK (author_id = auth.uid());
  END IF;
END $$;

-- 6. RPC function for defects dashboard
CREATE OR REPLACE FUNCTION get_defects_dashboard(
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0,
  p_sort_field TEXT DEFAULT 'asset_name',
  p_sort_dir TEXT DEFAULT 'asc'
)
RETURNS TABLE (
  id UUID,
  asset_name TEXT,
  turbine_name TEXT,
  turbine_model TEXT,
  defect_type TEXT,
  width_cm NUMERIC,
  height_cm NUMERIC,
  category INT,
  action_text TEXT,
  action_urgency TEXT,
  next_step TEXT,
  blade_position INT,
  side VARCHAR,
  root_distance NUMERIC,
  root_cause TEXT,
  notes TEXT,
  resolved BOOLEAN,
  inspection_id UUID,
  blade_id UUID,
  total_count BIGINT
) AS $$
SELECT
  d.id,
  wf.name AS asset_name,
  t.name AS turbine_name,
  t.model AS turbine_model,
  d.type AS defect_type,
  d.width_cm,
  d.height_cm,
  d.severity::INT AS category,
  d.action_text,
  d.action_urgency,
  d.next_step,
  b.position AS blade_position,
  d.side,
  d.distance_from_root AS root_distance,
  d.root_cause,
  d.notes,
  d.resolved,
  i.id AS inspection_id,
  b.id AS blade_id,
  COUNT(*) OVER() AS total_count
FROM defect d
JOIN inspection i ON i.id = d.inspection_id
JOIN blade b ON b.id = i.blade_id
JOIN turbine t ON t.id = b.turbine_id
JOIN wind_farm wf ON wf.id = t.wind_farm_id
WHERE (p_search = '' OR
  wf.name ILIKE '%' || p_search || '%' OR
  t.name ILIKE '%' || p_search || '%' OR
  t.model ILIKE '%' || p_search || '%' OR
  d.type ILIKE '%' || p_search || '%')
ORDER BY
  CASE WHEN p_sort_dir = 'asc' THEN
    CASE p_sort_field
      WHEN 'asset_name' THEN wf.name
      WHEN 'turbine_name' THEN t.name
      WHEN 'turbine_model' THEN t.model
      WHEN 'type' THEN d.type
      WHEN 'next_step' THEN d.next_step
      WHEN 'side' THEN d.side
    END
  END ASC NULLS LAST,
  CASE WHEN p_sort_dir = 'desc' THEN
    CASE p_sort_field
      WHEN 'asset_name' THEN wf.name
      WHEN 'turbine_name' THEN t.name
      WHEN 'turbine_model' THEN t.model
      WHEN 'type' THEN d.type
      WHEN 'next_step' THEN d.next_step
      WHEN 'side' THEN d.side
    END
  END DESC NULLS LAST,
  CASE WHEN p_sort_dir = 'asc' AND p_sort_field IN ('category', 'defect_size', 'root_distance', 'blade') THEN
    CASE p_sort_field
      WHEN 'category' THEN d.severity::NUMERIC
      WHEN 'defect_size' THEN d.width_cm * d.height_cm
      WHEN 'root_distance' THEN d.distance_from_root
      WHEN 'blade' THEN b.position::NUMERIC
    END
  END ASC NULLS LAST,
  CASE WHEN p_sort_dir = 'desc' AND p_sort_field IN ('category', 'defect_size', 'root_distance', 'blade') THEN
    CASE p_sort_field
      WHEN 'category' THEN d.severity::NUMERIC
      WHEN 'defect_size' THEN d.width_cm * d.height_cm
      WHEN 'root_distance' THEN d.distance_from_root
      WHEN 'blade' THEN b.position::NUMERIC
    END
  END DESC NULLS LAST
LIMIT p_limit OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
