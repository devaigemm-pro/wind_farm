-- Migration: Wind Farms Dashboard support
-- Adds powering_date to wind_farm, power_kw to turbine, and creates RPC function

-- 1. Add powering_date column to wind_farm
ALTER TABLE wind_farm
  ADD COLUMN IF NOT EXISTS powering_date TIMESTAMPTZ;

-- 2. Add power_kw column to turbine
ALTER TABLE turbine
  ADD COLUMN IF NOT EXISTS power_kw NUMERIC DEFAULT 0;

-- 3. Create RPC function for dashboard aggregated data
CREATE OR REPLACE FUNCTION get_wind_farms_dashboard()
RETURNS TABLE (
  id UUID,
  name TEXT,
  sub_assets_count BIGINT,
  inspections_count BIGINT,
  total_power NUMERIC,
  powering_date TIMESTAMPTZ,
  oldest_inspection TIMESTAMPTZ
) AS $$
SELECT
  wf.id,
  wf.name,
  COUNT(DISTINCT t.id) AS sub_assets_count,
  COUNT(DISTINCT i.id) AS inspections_count,
  COALESCE(SUM(DISTINCT t.power_kw), 0) AS total_power,
  wf.powering_date,
  MIN(i.created_at) AS oldest_inspection
FROM wind_farm wf
LEFT JOIN turbine t ON t.wind_farm_id = wf.id
LEFT JOIN blade b ON b.turbine_id = t.id
LEFT JOIN inspection i ON i.blade_id = b.id
GROUP BY wf.id, wf.name, wf.powering_date
ORDER BY wf.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
