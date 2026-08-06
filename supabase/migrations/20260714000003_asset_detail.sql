-- Migration: Asset Detail View (Ficha del Parque)
-- Adds campaigns table, serial number fields, document tracking, and RPC functions

-- 1. Create campaign table
CREATE TABLE IF NOT EXISTS campaign (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wind_farm_id UUID NOT NULL REFERENCES wind_farm(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_wind_farm_id ON campaign(wind_farm_id);

-- 2. Add campaign_id to inspection
ALTER TABLE inspection
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaign(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inspection_campaign_id ON inspection(campaign_id);

-- 3. Add serial number fields to turbine
ALTER TABLE turbine
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS tower_serial_number TEXT,
  ADD COLUMN IF NOT EXISTS anticlockwise BOOLEAN DEFAULT FALSE;

-- 4. Add serial_number to blade
ALTER TABLE blade
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- 5. Create asset_document table for tracking uploaded documents
CREATE TABLE IF NOT EXISTS asset_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wind_farm_id UUID NOT NULL REFERENCES wind_farm(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_document_wind_farm_id ON asset_document(wind_farm_id);

-- 6. Add inspection_type column to inspection if not exists
ALTER TABLE inspection
  ADD COLUMN IF NOT EXISTS inspection_type TEXT DEFAULT 'blades';

-- 7. Add photos_count and viewed_percent to inspection
ALTER TABLE inspection
  ADD COLUMN IF NOT EXISTS photos_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS viewed_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 8. RLS policies for campaign
ALTER TABLE campaign ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read campaigns'
  ) THEN
    CREATE POLICY "Authenticated users can read campaigns"
      ON campaign FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Supervisors and admins can manage campaigns'
  ) THEN
    CREATE POLICY "Supervisors and admins can manage campaigns"
      ON campaign FOR ALL TO authenticated
      USING (true)
      WITH CHECK (get_user_role() IN ('supervisor', 'admin'));
  END IF;
END $$;

-- 9. RLS policies for asset_document
ALTER TABLE asset_document ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read asset documents'
  ) THEN
    CREATE POLICY "Authenticated users can read asset documents"
      ON asset_document FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Supervisors and admins can manage asset documents'
  ) THEN
    CREATE POLICY "Supervisors and admins can manage asset documents"
      ON asset_document FOR ALL TO authenticated
      USING (true)
      WITH CHECK (get_user_role() IN ('supervisor', 'admin'));
  END IF;
END $$;

-- 10. RPC function for wind farm detail with aggregated data
CREATE OR REPLACE FUNCTION get_wind_farm_detail(p_wind_farm_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  location TEXT,
  powering_date TIMESTAMPTZ,
  total_power NUMERIC,
  sub_assets_count BIGINT,
  oldest_inspection TIMESTAMPTZ,
  inspections_count BIGINT
) AS $$
SELECT
  wf.id,
  wf.name,
  wf.location,
  wf.powering_date,
  COALESCE(SUM(DISTINCT t.power_kw), 0) AS total_power,
  COUNT(DISTINCT t.id) AS sub_assets_count,
  MIN(i.created_at) AS oldest_inspection,
  COUNT(DISTINCT i.id) AS inspections_count
FROM wind_farm wf
LEFT JOIN turbine t ON t.wind_farm_id = wf.id
LEFT JOIN blade b ON b.turbine_id = t.id
LEFT JOIN inspection i ON i.blade_id = b.id
WHERE wf.id = p_wind_farm_id
GROUP BY wf.id, wf.name, wf.location, wf.powering_date;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 11. RPC function for turbine subassets table
CREATE OR REPLACE FUNCTION get_wind_farm_subassets(p_wind_farm_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  model TEXT,
  serial_number TEXT,
  power_kw NUMERIC,
  powering_date TIMESTAMPTZ,
  last_inspection TIMESTAMPTZ,
  inspections_count BIGINT
) AS $$
SELECT
  t.id,
  t.name,
  t.model,
  t.serial_number,
  t.power_kw,
  t.powering_date,
  MAX(i.created_at) AS last_inspection,
  COUNT(DISTINCT i.id) AS inspections_count
FROM turbine t
LEFT JOIN blade b ON b.turbine_id = t.id
LEFT JOIN inspection i ON i.blade_id = b.id
WHERE t.wind_farm_id = p_wind_farm_id
GROUP BY t.id, t.name, t.model, t.serial_number, t.power_kw, t.powering_date
ORDER BY t.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 12. Add powering_date to turbine if not exists
ALTER TABLE turbine
  ADD COLUMN IF NOT EXISTS powering_date TIMESTAMPTZ;

-- 13. Updated_at trigger for campaign
DROP TRIGGER IF EXISTS set_campaign_updated_at ON campaign;
CREATE TRIGGER set_campaign_updated_at
  BEFORE UPDATE ON campaign
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
