-- RPC: get_upload_records
-- Devuelve UNA FILA POR SINCRONIZACIÓN (campaign que tenga >= 1 foto en inspection_photo).
-- Alimenta la vista /inspections/upload (Cargas/Uploads).
--
-- Columnas:
--   campaign_id    -> id de la campaña (sincronización)
--   campaign_name  -> nombre de la campaña
--   wind_farm_id   -> id del parque (para navegación)
--   wind_farm_name -> nombre del parque eólico
--   turbine_names  -> nombres de las turbinas asociadas a la campaña (array)
--   photo_count    -> total de fotos de la campaña
--   uploaded_by    -> nombre (o email) del usuario que creó la campaña (campaign.created_by -> profiles)
--   uploaded_at    -> MAX(uploaded_at) de las fotos = "cuándo se sincronizó"
--   status         -> campaign.status
CREATE OR REPLACE FUNCTION get_upload_records()
RETURNS TABLE (
  campaign_id UUID,
  campaign_name TEXT,
  wind_farm_id UUID,
  wind_farm_name TEXT,
  turbine_names TEXT[],
  photo_count BIGINT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ,
  status TEXT
) AS $$
SELECT
  c.id AS campaign_id,
  c.name AS campaign_name,
  c.wind_farm_id,
  wf.name AS wind_farm_name,
  COALESCE(
    ARRAY(
      SELECT DISTINCT t.name
      FROM inspection i
      JOIN turbine t ON t.id = i.turbine_id
      WHERE i.campaign_id = c.id AND t.name IS NOT NULL
      ORDER BY t.name
    ),
    ARRAY[]::TEXT[]
  ) AS turbine_names,
  ph.photo_count,
  COALESCE(NULLIF(p.name, ''), p.email) AS uploaded_by,
  ph.last_uploaded_at AS uploaded_at,
  c.status
FROM campaign c
JOIN (
  SELECT
    ip.campaign_id,
    COUNT(*)::BIGINT AS photo_count,
    MAX(ip.uploaded_at) AS last_uploaded_at
  FROM inspection_photo ip
  GROUP BY ip.campaign_id
) ph ON ph.campaign_id = c.id
LEFT JOIN wind_farm wf ON wf.id = c.wind_farm_id
LEFT JOIN profiles p ON p.id = c.created_by
ORDER BY ph.last_uploaded_at DESC;
$$ LANGUAGE sql STABLE SECURITY INVOKER;
