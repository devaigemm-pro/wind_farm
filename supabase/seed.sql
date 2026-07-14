-- Seed data for Wind Blade Inspection development environment
--
-- NOTE: In production, profiles are created via the auth trigger (handle_new_user)
-- when a user signs up through Supabase Auth. For development seeding, we insert
-- auth.users directly so profiles are created via the trigger. If the trigger doesn't
-- fire (e.g., RLS or permissions issue), we insert profiles as a fallback.
--
-- The turbine trigger (create_blades_for_turbine) is disabled during seeding so we
-- can insert blades with deterministic UUIDs. It is re-enabled afterwards.
--
-- Usage: Run `supabase db reset` to apply migrations and seed data.
-- Login credentials: all seed users use password "password123"

----------------------------------------------------------------------
-- 1. Auth users + Profiles (fixed UUIDs, one per role)
--    We insert into auth.users first so the FK on profiles is satisfied.
--    The handle_new_user trigger will auto-create profiles, but we use
--    raw_user_meta_data to control the role assignment.
--    Password for all seed users: "password123" (bcrypt hash below).
----------------------------------------------------------------------
-- GoTrue's user-loading query does a strict scan into Go string types on
-- these columns, so NULLs cause "500: Database error querying schema"
-- during password login. Setting them to '' up front keeps seed users
-- usable without an extra fix-up pass.
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at, aud, role,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('a1b2c3d4-0001-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'inspector@windfarm.dev',  '$2a$10$PznPCEaR7B6MFQp2sEfP7.GE2bM3pBDImJ3r5Kbv7XI/GaFgMpFHi', now(), '{"name": "Carlos Vega", "role": "inspector"}',   '{"provider":"email","providers":["email"]}', now(), now(), 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''),
  ('a1b2c3d4-0002-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'supervisor@windfarm.dev', '$2a$10$PznPCEaR7B6MFQp2sEfP7.GE2bM3pBDImJ3r5Kbv7XI/GaFgMpFHi', now(), '{"name": "María López", "role": "supervisor"}', '{"provider":"email","providers":["email"]}', now(), now(), 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''),
  ('a1b2c3d4-0003-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'admin@windfarm.dev',      '$2a$10$PznPCEaR7B6MFQp2sEfP7.GE2bM3pBDImJ3r5Kbv7XI/GaFgMpFHi', now(), '{"name": "Andrés Ruiz", "role": "admin"}',      '{"provider":"email","providers":["email"]}', now(), now(), 'authenticated', 'authenticated', '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

-- The trigger should have created profiles, but insert as fallback
insert into public.profiles (id, email, name, role) values
  ('a1b2c3d4-0001-4000-8000-000000000001', 'inspector@windfarm.dev', 'Carlos Vega', 'inspector'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'supervisor@windfarm.dev', 'María López', 'supervisor'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'admin@windfarm.dev', 'Andrés Ruiz', 'admin')
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 2. Wind Farms
----------------------------------------------------------------------
insert into public.wind_farm (id, name, location, latitude, longitude) values
  ('f0000000-0001-4000-8000-000000000001', 'Parque Eólico Norte', 'Navarra, España', 42.8125, -1.6458),
  ('f0000000-0002-4000-8000-000000000002', 'Parque Eólico Sur', 'Cádiz, España', 36.5271, -6.2886)
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 3. Turbines and Blades
--    We disable the blade auto-creation trigger so we can insert blades
--    with deterministic UUIDs for referencing in inspections below.
----------------------------------------------------------------------
alter table public.turbine disable trigger on_turbine_created;

insert into public.turbine (id, wind_farm_id, name, model) values
  ('10000000-0001-4000-8000-000000000001', 'f0000000-0001-4000-8000-000000000001', 'T-N01', 'Vestas V150'),
  ('10000000-0002-4000-8000-000000000002', 'f0000000-0001-4000-8000-000000000001', 'T-N02', 'Vestas V150'),
  ('10000000-0003-4000-8000-000000000003', 'f0000000-0002-4000-8000-000000000002', 'T-S01', 'Siemens Gamesa SG 5.8'),
  ('10000000-0004-4000-8000-000000000004', 'f0000000-0002-4000-8000-000000000002', 'T-S02', 'Siemens Gamesa SG 5.8')
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 4. Blades (deterministic UUIDs for FK references)
----------------------------------------------------------------------
insert into public.blade (id, turbine_id, position) values
  -- Turbine T-N01 blades
  ('b0000000-0001-4000-8000-000000000001', '10000000-0001-4000-8000-000000000001', 1),
  ('b0000000-0002-4000-8000-000000000002', '10000000-0001-4000-8000-000000000001', 2),
  ('b0000000-0003-4000-8000-000000000003', '10000000-0001-4000-8000-000000000001', 3),
  -- Turbine T-N02 blades
  ('b0000000-0004-4000-8000-000000000004', '10000000-0002-4000-8000-000000000002', 1),
  ('b0000000-0005-4000-8000-000000000005', '10000000-0002-4000-8000-000000000002', 2),
  ('b0000000-0006-4000-8000-000000000006', '10000000-0002-4000-8000-000000000002', 3),
  -- Turbine T-S01 blades
  ('b0000000-0007-4000-8000-000000000007', '10000000-0003-4000-8000-000000000003', 1),
  ('b0000000-0008-4000-8000-000000000008', '10000000-0003-4000-8000-000000000003', 2),
  ('b0000000-0009-4000-8000-000000000009', '10000000-0003-4000-8000-000000000003', 3),
  -- Turbine T-S02 blades
  ('b0000000-0010-4000-8000-000000000010', '10000000-0004-4000-8000-000000000004', 1),
  ('b0000000-0011-4000-8000-000000000011', '10000000-0004-4000-8000-000000000004', 2),
  ('b0000000-0012-4000-8000-000000000012', '10000000-0004-4000-8000-000000000004', 3)
on conflict (turbine_id, position) do nothing;

-- Re-enable the trigger for normal application use
alter table public.turbine enable trigger on_turbine_created;

----------------------------------------------------------------------
-- 5. Inspections (various statuses and stages)
----------------------------------------------------------------------
insert into public.inspection (id, blade_id, inspector_id, status, stage, scheduled_date, completed_at, approved_by, approved_at) values
  -- In-progress inspection (recently started)
  ('20000000-0001-4000-8000-000000000001', 'b0000000-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'in_progress', 'uploaded', '2024-03-15', null, null, null),
  -- In-progress inspection (annotated stage)
  ('20000000-0002-4000-8000-000000000002', 'b0000000-0004-4000-8000-000000000004', 'a1b2c3d4-0001-4000-8000-000000000001', 'in_progress', 'annotated', '2024-03-10', null, null, null),
  -- Completed inspection (awaiting approval)
  ('20000000-0003-4000-8000-000000000003', 'b0000000-0007-4000-8000-000000000007', 'a1b2c3d4-0001-4000-8000-000000000001', 'completed', 'finalized', '2024-02-20', '2024-02-25 14:30:00+00', null, null),
  -- Approved inspection
  ('20000000-0004-4000-8000-000000000004', 'b0000000-0002-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001', 'approved', 'finalized', '2024-01-10', '2024-01-15 10:00:00+00', 'a1b2c3d4-0002-4000-8000-000000000002', '2024-01-18 09:00:00+00'),
  -- Another in-progress (early stage)
  ('20000000-0005-4000-8000-000000000005', 'b0000000-0010-4000-8000-000000000010', 'a1b2c3d4-0001-4000-8000-000000000001', 'in_progress', 'planned', '2024-04-01', null, null, null),
  -- Approved older inspection
  ('20000000-0006-4000-8000-000000000006', 'b0000000-0008-4000-8000-000000000008', 'a1b2c3d4-0001-4000-8000-000000000001', 'approved', 'finalized', '2023-11-05', '2023-11-10 16:00:00+00', 'a1b2c3d4-0002-4000-8000-000000000002', '2023-11-12 11:00:00+00')
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 6. Evidence records (placeholder storage paths)
----------------------------------------------------------------------
insert into public.evidence (id, inspection_id, filename, mime_type, size_bytes, storage_path, geo_lat, geo_lng) values
  ('e0000000-0001-4000-8000-000000000001', '20000000-0001-4000-8000-000000000001', 'blade_leading_edge_01.jpg', 'image/jpeg', 2450000, 'evidence/20000000-0001/blade_leading_edge_01.jpg', 42.8130, -1.6462),
  ('e0000000-0002-4000-8000-000000000002', '20000000-0001-4000-8000-000000000001', 'blade_tip_damage_01.png', 'image/png', 3100000, 'evidence/20000000-0001/blade_tip_damage_01.png', 42.8130, -1.6462),
  ('e0000000-0003-4000-8000-000000000003', '20000000-0002-4000-8000-000000000002', 'surface_crack_01.jpg', 'image/jpeg', 1850000, 'evidence/20000000-0002/surface_crack_01.jpg', 42.8126, -1.6455),
  ('e0000000-0004-4000-8000-000000000004', '20000000-0003-4000-8000-000000000003', 'overview_blade_s01.jpg', 'image/jpeg', 4200000, 'evidence/20000000-0003/overview_blade_s01.jpg', 36.5275, -6.2890),
  ('e0000000-0005-4000-8000-000000000005', '20000000-0003-4000-8000-000000000003', 'erosion_detail_01.jpg', 'image/jpeg', 2900000, 'evidence/20000000-0003/erosion_detail_01.jpg', 36.5275, -6.2890),
  ('e0000000-0006-4000-8000-000000000006', '20000000-0004-4000-8000-000000000004', 'approved_inspection_img.jpg', 'image/jpeg', 1500000, 'evidence/20000000-0004/approved_inspection_img.jpg', 42.8125, -1.6458),
  ('e0000000-0007-4000-8000-000000000007', '20000000-0006-4000-8000-000000000006', 'historical_damage_01.jpg', 'image/jpeg', 2200000, 'evidence/20000000-0006/historical_damage_01.jpg', 36.5270, -6.2885)
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 7. Defects with varying types and severities
----------------------------------------------------------------------
insert into public.defect (id, inspection_id, type, severity, distance_from_root, description) values
  ('d0000000-0001-4000-8000-000000000001', '20000000-0001-4000-8000-000000000001', 'le_erosion', 3, 45.5, 'Leading edge erosion near blade tip, approximately 30cm length'),
  ('d0000000-0002-4000-8000-000000000002', '20000000-0001-4000-8000-000000000001', 'crack', 4, 22.0, 'Transverse crack on suction side, 15cm visible length'),
  ('d0000000-0003-4000-8000-000000000003', '20000000-0002-4000-8000-000000000002', 'paint_defect', 2, 10.3, 'Paint peeling on pressure side near root section'),
  ('d0000000-0004-4000-8000-000000000004', '20000000-0003-4000-8000-000000000003', 'lightning_damage', 5, 48.0, 'Lightning receptor damage with char marks and surface delamination'),
  ('d0000000-0005-4000-8000-000000000005', '20000000-0003-4000-8000-000000000003', 'vortex', 2, 35.2, 'Minor vortex generator wear, cosmetic only'),
  ('d0000000-0006-4000-8000-000000000006', '20000000-0004-4000-8000-000000000004', 'delamination', 4, 28.7, 'Trailing edge delamination extending 40cm, repaired'),
  ('d0000000-0007-4000-8000-000000000007', '20000000-0006-4000-8000-000000000006', 'le_erosion', 3, 42.0, 'Historical leading edge erosion, monitored since 2023'),
  ('d0000000-0008-4000-8000-000000000008', '20000000-0006-4000-8000-000000000006', 'other', 1, 5.0, 'Bird droppings accumulation near root, cleaned')
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 8. Defect-Image links
----------------------------------------------------------------------
insert into public.defect_image (defect_id, evidence_id) values
  ('d0000000-0001-4000-8000-000000000001', 'e0000000-0001-4000-8000-000000000001'),
  ('d0000000-0002-4000-8000-000000000002', 'e0000000-0002-4000-8000-000000000002'),
  ('d0000000-0003-4000-8000-000000000003', 'e0000000-0003-4000-8000-000000000003'),
  ('d0000000-0004-4000-8000-000000000004', 'e0000000-0004-4000-8000-000000000004'),
  ('d0000000-0004-4000-8000-000000000004', 'e0000000-0005-4000-8000-000000000005'),
  ('d0000000-0006-4000-8000-000000000006', 'e0000000-0006-4000-8000-000000000006'),
  ('d0000000-0007-4000-8000-000000000007', 'e0000000-0007-4000-8000-000000000007')
on conflict (defect_id, evidence_id) do nothing;
