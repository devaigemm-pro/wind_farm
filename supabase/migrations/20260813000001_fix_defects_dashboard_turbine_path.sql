-- Fix get_defects_dashboard to support inspections linked via turbine_id (without blade_id)
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
  COALESCE(wf_blade.name, wf_direct.name) AS asset_name,
  COALESCE(t_blade.name, t_direct.name) AS turbine_name,
  COALESCE(t_blade.model, t_direct.model) AS turbine_model,
  d.type AS defect_type,
  d.width_cm,
  d.height_cm,
  d.severity::INT AS category,
  d.action_text,
  d.action_urgency,
  d.next_step,
  COALESCE(b.position, 0) AS blade_position,
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
LEFT JOIN blade b ON b.id = i.blade_id
LEFT JOIN turbine t_blade ON t_blade.id = b.turbine_id
LEFT JOIN wind_farm wf_blade ON wf_blade.id = t_blade.wind_farm_id
LEFT JOIN turbine t_direct ON t_direct.id = i.turbine_id
LEFT JOIN wind_farm wf_direct ON wf_direct.id = t_direct.wind_farm_id
WHERE
  (COALESCE(t_blade.id, t_direct.id) IS NOT NULL) AND
  (p_search = '' OR
    COALESCE(wf_blade.name, wf_direct.name, '') ILIKE '%' || p_search || '%' OR
    COALESCE(t_blade.name, t_direct.name, '') ILIKE '%' || p_search || '%' OR
    COALESCE(t_blade.model, t_direct.model, '') ILIKE '%' || p_search || '%' OR
    d.type ILIKE '%' || p_search || '%')
ORDER BY
  CASE WHEN p_sort_dir = 'asc' THEN
    CASE p_sort_field
      WHEN 'asset_name' THEN COALESCE(wf_blade.name, wf_direct.name)
      WHEN 'turbine_name' THEN COALESCE(t_blade.name, t_direct.name)
      WHEN 'turbine_model' THEN COALESCE(t_blade.model, t_direct.model)
      WHEN 'type' THEN d.type
      WHEN 'next_step' THEN d.next_step
      WHEN 'side' THEN d.side
    END
  END ASC NULLS LAST,
  CASE WHEN p_sort_dir = 'desc' THEN
    CASE p_sort_field
      WHEN 'asset_name' THEN COALESCE(wf_blade.name, wf_direct.name)
      WHEN 'turbine_name' THEN COALESCE(t_blade.name, t_direct.name)
      WHEN 'turbine_model' THEN COALESCE(t_blade.model, t_direct.model)
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
      WHEN 'blade' THEN COALESCE(b.position, 0)::NUMERIC
    END
  END ASC NULLS LAST,
  CASE WHEN p_sort_dir = 'desc' AND p_sort_field IN ('category', 'defect_size', 'root_distance', 'blade') THEN
    CASE p_sort_field
      WHEN 'category' THEN d.severity::NUMERIC
      WHEN 'defect_size' THEN d.width_cm * d.height_cm
      WHEN 'root_distance' THEN d.distance_from_root
      WHEN 'blade' THEN COALESCE(b.position, 0)::NUMERIC
    END
  END DESC NULLS LAST
LIMIT p_limit OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
