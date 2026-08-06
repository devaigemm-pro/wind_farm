-- Seed historical inspections and defects for Compare feature
-- Run with: npx supabase db query --linked < scripts/seed-defect-history.sql

-- Create a historical inspection for the first blade
INSERT INTO inspection (id, blade_id, inspector_id, scheduled_date, completed_at, status, stage, created_at)
SELECT 
  'i0000000-hist-4000-8000-000000000001',
  b.id,
  (SELECT id FROM profiles LIMIT 1),
  '2025-12-15',
  '2025-12-15T14:00:00Z',
  'approved',
  'finalized',
  '2025-12-15T14:00:00Z'
FROM blade b
JOIN turbine t ON t.id = b.turbine_id
WHERE t.wind_farm_id = 'f0000000-0001-4000-8000-000000000001'
ORDER BY t.name, b.position
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Create a second historical inspection (older)
INSERT INTO inspection (id, blade_id, inspector_id, scheduled_date, completed_at, status, stage, created_at)
SELECT 
  'i0000000-hist-4000-8000-000000000002',
  b.id,
  (SELECT id FROM profiles LIMIT 1),
  '2025-06-20',
  '2025-06-20T10:00:00Z',
  'approved',
  'finalized',
  '2025-06-20T10:00:00Z'
FROM blade b
JOIN turbine t ON t.id = b.turbine_id
WHERE t.wind_farm_id = 'f0000000-0001-4000-8000-000000000001'
ORDER BY t.name, b.position
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Add historical defects
INSERT INTO defect (id, inspection_id, type, severity, distance_from_root, description, side, width_cm, height_cm, resolved)
VALUES
  ('d0000000-hist-4000-8000-000000000001', 'i0000000-hist-4000-8000-000000000001', 'le_erosion', 2, 31.5, 'Minor erosion - Dec 2025', 'LE', 8, 120, true),
  ('d0000000-hist-4000-8000-000000000002', 'i0000000-hist-4000-8000-000000000001', 'vortex', 2, 29.7, 'VG loosening - Dec 2025', 'SS', 5, 200, true),
  ('d0000000-hist-4000-8000-000000000003', 'i0000000-hist-4000-8000-000000000001', 'le_erosion', 1, 37.6, 'Surface wear - Dec 2025', 'LE', 3, 50, true),
  ('d0000000-hist-4000-8000-000000000004', 'i0000000-hist-4000-8000-000000000002', 'le_erosion', 1, 31.2, 'Hairline mark - Jun 2025', 'LE', 2, 30, true),
  ('d0000000-hist-4000-8000-000000000005', 'i0000000-hist-4000-8000-000000000002', 'vortex', 1, 30.0, 'Minor VG check - Jun 2025', 'SS', 2, 100, true)
ON CONFLICT (id) DO NOTHING;
