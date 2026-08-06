-- Combined migration: Drone inspection photos system

-- Campaign status enum
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'awaiting_photos';

-- Inspection photo table (fotos capturadas por drone)
CREATE TABLE IF NOT EXISTS inspection_photo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  inspection_id UUID REFERENCES inspection(id) ON DELETE SET NULL,
  blade_id UUID NOT NULL REFERENCES blade(id) ON DELETE CASCADE,
  face TEXT NOT NULL CHECK (face IN ('leading_edge', 'trailing_edge', 'suction_side', 'pressure_side')),
  radial_position NUMERIC NOT NULL CHECK (radial_position >= 0 AND radial_position <= 1),
  flight_plan_order INT NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  thumbnail_path TEXT,
  width_px INT,
  height_px INT,
  captured_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  analyzed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_inspection_photo_campaign ON inspection_photo(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inspection_photo_blade ON inspection_photo(blade_id);
CREATE INDEX IF NOT EXISTS idx_inspection_photo_face ON inspection_photo(blade_id, face);
CREATE INDEX IF NOT EXISTS idx_inspection_photo_order ON inspection_photo(campaign_id, blade_id, face, flight_plan_order);

-- RLS
ALTER TABLE inspection_photo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inspection photos"
  ON inspection_photo FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert inspection photos"
  ON inspection_photo FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Supervisors and admins can manage inspection photos"
  ON inspection_photo FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- RPC: Get upload progress per campaign
CREATE OR REPLACE FUNCTION get_campaign_upload_progress(p_campaign_id UUID)
RETURNS TABLE (
  blade_id UUID,
  blade_position INT,
  face TEXT,
  photo_count BIGINT,
  analyzed_count BIGINT
) AS $$
SELECT
  ip.blade_id,
  b.position AS blade_position,
  ip.face,
  COUNT(*)::BIGINT AS photo_count,
  COUNT(*) FILTER (WHERE ip.analyzed = TRUE)::BIGINT AS analyzed_count
FROM inspection_photo ip
JOIN blade b ON b.id = ip.blade_id
WHERE ip.campaign_id = p_campaign_id
GROUP BY ip.blade_id, b.position, ip.face
ORDER BY b.position, ip.face;
$$ LANGUAGE sql STABLE SECURITY INVOKER;
