-- ============================================================
-- Migration: Enable blade serial number updates + seed data
-- ============================================================
-- Execute this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/esphlzrzwmzeozjmyvqm/sql
-- ============================================================

-- 1. Add UPDATE policy for blade table
CREATE POLICY "blade_update_admin_supervisor"
ON public.blade
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'supervisor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'supervisor')
  )
);

-- 2. Seed blade serial numbers for Alto de la Degollada (ADD-T01 to ADD-T04)
UPDATE blade SET serial_number = 'BLD-NX163-A-0451' WHERE turbine_id = '10000000-0013-4000-8000-000000000013' AND position = 1;
UPDATE blade SET serial_number = 'BLD-NX163-B-0451' WHERE turbine_id = '10000000-0013-4000-8000-000000000013' AND position = 2;
UPDATE blade SET serial_number = 'BLD-NX163-C-0451' WHERE turbine_id = '10000000-0013-4000-8000-000000000013' AND position = 3;

UPDATE blade SET serial_number = 'BLD-NX163-A-0452' WHERE turbine_id = '10000000-0014-4000-8000-000000000014' AND position = 1;
UPDATE blade SET serial_number = 'BLD-NX163-B-0452' WHERE turbine_id = '10000000-0014-4000-8000-000000000014' AND position = 2;
UPDATE blade SET serial_number = 'BLD-NX163-C-0452' WHERE turbine_id = '10000000-0014-4000-8000-000000000014' AND position = 3;

UPDATE blade SET serial_number = 'BLD-NX163-A-0453' WHERE turbine_id = '10000000-0015-4000-8000-000000000015' AND position = 1;
UPDATE blade SET serial_number = 'BLD-NX163-B-0453' WHERE turbine_id = '10000000-0015-4000-8000-000000000015' AND position = 2;
UPDATE blade SET serial_number = 'BLD-NX163-C-0453' WHERE turbine_id = '10000000-0015-4000-8000-000000000015' AND position = 3;

UPDATE blade SET serial_number = 'BLD-NX163-A-0454' WHERE turbine_id = '10000000-0016-4000-8000-000000000016' AND position = 1;
UPDATE blade SET serial_number = 'BLD-NX163-B-0454' WHERE turbine_id = '10000000-0016-4000-8000-000000000016' AND position = 2;
UPDATE blade SET serial_number = 'BLD-NX163-C-0454' WHERE turbine_id = '10000000-0016-4000-8000-000000000016' AND position = 3;

-- 3. Seed blade serials for Filo de Magocs (FDM-T01 to T07)
UPDATE blade SET serial_number = 'BLD-V150-A-1001' WHERE turbine_id = '10000000-0001-4000-8000-000000000001' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V150-B-1001' WHERE turbine_id = '10000000-0001-4000-8000-000000000001' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V150-C-1001' WHERE turbine_id = '10000000-0001-4000-8000-000000000001' AND position = 3;
UPDATE blade SET serial_number = 'BLD-V150-A-1002' WHERE turbine_id = '10000000-0002-4000-8000-000000000002' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V150-B-1002' WHERE turbine_id = '10000000-0002-4000-8000-000000000002' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V150-C-1002' WHERE turbine_id = '10000000-0002-4000-8000-000000000002' AND position = 3;
UPDATE blade SET serial_number = 'BLD-V150-A-1003' WHERE turbine_id = '10000000-0003-4000-8000-000000000003' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V150-B-1003' WHERE turbine_id = '10000000-0003-4000-8000-000000000003' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V150-C-1003' WHERE turbine_id = '10000000-0003-4000-8000-000000000003' AND position = 3;
UPDATE blade SET serial_number = 'BLD-V150-A-1004' WHERE turbine_id = '10000000-0004-4000-8000-000000000004' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V150-B-1004' WHERE turbine_id = '10000000-0004-4000-8000-000000000004' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V150-C-1004' WHERE turbine_id = '10000000-0004-4000-8000-000000000004' AND position = 3;
UPDATE blade SET serial_number = 'BLD-V150-A-1005' WHERE turbine_id = '10000000-0005-4000-8000-000000000005' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V150-B-1005' WHERE turbine_id = '10000000-0005-4000-8000-000000000005' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V150-C-1005' WHERE turbine_id = '10000000-0005-4000-8000-000000000005' AND position = 3;
UPDATE blade SET serial_number = 'BLD-V150-A-1006' WHERE turbine_id = '10000000-0006-4000-8000-000000000006' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V150-B-1006' WHERE turbine_id = '10000000-0006-4000-8000-000000000006' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V150-C-1006' WHERE turbine_id = '10000000-0006-4000-8000-000000000006' AND position = 3;
UPDATE blade SET serial_number = 'BLD-V150-A-1007' WHERE turbine_id = '10000000-0007-4000-8000-000000000007' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V150-B-1007' WHERE turbine_id = '10000000-0007-4000-8000-000000000007' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V150-C-1007' WHERE turbine_id = '10000000-0007-4000-8000-000000000007' AND position = 3;

-- 4. Seed blade serials for Sierra del Madero (SDM-T01 to T05)
UPDATE blade SET serial_number = 'BLD-SG58-A-2001' WHERE turbine_id = '10000000-0008-4000-8000-000000000008' AND position = 1;
UPDATE blade SET serial_number = 'BLD-SG58-B-2001' WHERE turbine_id = '10000000-0008-4000-8000-000000000008' AND position = 2;
UPDATE blade SET serial_number = 'BLD-SG58-C-2001' WHERE turbine_id = '10000000-0008-4000-8000-000000000008' AND position = 3;
UPDATE blade SET serial_number = 'BLD-SG58-A-2002' WHERE turbine_id = '10000000-0009-4000-8000-000000000009' AND position = 1;
UPDATE blade SET serial_number = 'BLD-SG58-B-2002' WHERE turbine_id = '10000000-0009-4000-8000-000000000009' AND position = 2;
UPDATE blade SET serial_number = 'BLD-SG58-C-2002' WHERE turbine_id = '10000000-0009-4000-8000-000000000009' AND position = 3;
UPDATE blade SET serial_number = 'BLD-SG58-A-2003' WHERE turbine_id = '10000000-0010-4000-8000-000000000010' AND position = 1;
UPDATE blade SET serial_number = 'BLD-SG58-B-2003' WHERE turbine_id = '10000000-0010-4000-8000-000000000010' AND position = 2;
UPDATE blade SET serial_number = 'BLD-SG58-C-2003' WHERE turbine_id = '10000000-0010-4000-8000-000000000010' AND position = 3;
UPDATE blade SET serial_number = 'BLD-SG58-A-2004' WHERE turbine_id = '10000000-0011-4000-8000-000000000011' AND position = 1;
UPDATE blade SET serial_number = 'BLD-SG58-B-2004' WHERE turbine_id = '10000000-0011-4000-8000-000000000011' AND position = 2;
UPDATE blade SET serial_number = 'BLD-SG58-C-2004' WHERE turbine_id = '10000000-0011-4000-8000-000000000011' AND position = 3;
UPDATE blade SET serial_number = 'BLD-SG58-A-2005' WHERE turbine_id = '10000000-0012-4000-8000-000000000012' AND position = 1;
UPDATE blade SET serial_number = 'BLD-SG58-B-2005' WHERE turbine_id = '10000000-0012-4000-8000-000000000012' AND position = 2;
UPDATE blade SET serial_number = 'BLD-SG58-C-2005' WHERE turbine_id = '10000000-0012-4000-8000-000000000012' AND position = 3;

-- 5. Seed blade serials for Peña del Cuervo (PDC-T01 to T08)
UPDATE blade SET serial_number = 'BLD-E126-A-3001' WHERE turbine_id = '10000000-0017-4000-8000-000000000017' AND position = 1;
UPDATE blade SET serial_number = 'BLD-E126-B-3001' WHERE turbine_id = '10000000-0017-4000-8000-000000000017' AND position = 2;
UPDATE blade SET serial_number = 'BLD-E126-C-3001' WHERE turbine_id = '10000000-0017-4000-8000-000000000017' AND position = 3;
UPDATE blade SET serial_number = 'BLD-E126-A-3002' WHERE turbine_id = '10000000-0018-4000-8000-000000000018' AND position = 1;
UPDATE blade SET serial_number = 'BLD-E126-B-3002' WHERE turbine_id = '10000000-0018-4000-8000-000000000018' AND position = 2;
UPDATE blade SET serial_number = 'BLD-E126-C-3002' WHERE turbine_id = '10000000-0018-4000-8000-000000000018' AND position = 3;
UPDATE blade SET serial_number = 'BLD-E126-A-3003' WHERE turbine_id = '10000000-0019-4000-8000-000000000019' AND position = 1;
UPDATE blade SET serial_number = 'BLD-E126-B-3003' WHERE turbine_id = '10000000-0019-4000-8000-000000000019' AND position = 2;
UPDATE blade SET serial_number = 'BLD-E126-C-3003' WHERE turbine_id = '10000000-0019-4000-8000-000000000019' AND position = 3;
UPDATE blade SET serial_number = 'BLD-E126-A-3004' WHERE turbine_id = '10000000-0020-4000-8000-000000000020' AND position = 1;
UPDATE blade SET serial_number = 'BLD-E126-B-3004' WHERE turbine_id = '10000000-0020-4000-8000-000000000020' AND position = 2;
UPDATE blade SET serial_number = 'BLD-E126-C-3004' WHERE turbine_id = '10000000-0020-4000-8000-000000000020' AND position = 3;
UPDATE blade SET serial_number = 'BLD-E126-A-3005' WHERE turbine_id = '10000000-0021-4000-8000-000000000021' AND position = 1;
UPDATE blade SET serial_number = 'BLD-E126-B-3005' WHERE turbine_id = '10000000-0021-4000-8000-000000000021' AND position = 2;
UPDATE blade SET serial_number = 'BLD-E126-C-3005' WHERE turbine_id = '10000000-0021-4000-8000-000000000021' AND position = 3;
UPDATE blade SET serial_number = 'BLD-E126-A-3006' WHERE turbine_id = '10000000-0022-4000-8000-000000000022' AND position = 1;
UPDATE blade SET serial_number = 'BLD-E126-B-3006' WHERE turbine_id = '10000000-0022-4000-8000-000000000022' AND position = 2;
UPDATE blade SET serial_number = 'BLD-E126-C-3006' WHERE turbine_id = '10000000-0022-4000-8000-000000000022' AND position = 3;
UPDATE blade SET serial_number = 'BLD-E126-A-3007' WHERE turbine_id = '10000000-0023-4000-8000-000000000023' AND position = 1;
UPDATE blade SET serial_number = 'BLD-E126-B-3007' WHERE turbine_id = '10000000-0023-4000-8000-000000000023' AND position = 2;
UPDATE blade SET serial_number = 'BLD-E126-C-3007' WHERE turbine_id = '10000000-0023-4000-8000-000000000023' AND position = 3;
UPDATE blade SET serial_number = 'BLD-E126-A-3008' WHERE turbine_id = '10000000-0024-4000-8000-000000000024' AND position = 1;
UPDATE blade SET serial_number = 'BLD-E126-B-3008' WHERE turbine_id = '10000000-0024-4000-8000-000000000024' AND position = 2;
UPDATE blade SET serial_number = 'BLD-E126-C-3008' WHERE turbine_id = '10000000-0024-4000-8000-000000000024' AND position = 3;

-- 6. Seed blade serials for Los Llanos de Aridane (LLA-T01 to T03)
UPDATE blade SET serial_number = 'BLD-V236-A-4001' WHERE turbine_id = '10000000-0025-4000-8000-000000000025' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V236-B-4001' WHERE turbine_id = '10000000-0025-4000-8000-000000000025' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V236-C-4001' WHERE turbine_id = '10000000-0025-4000-8000-000000000025' AND position = 3;
UPDATE blade SET serial_number = 'BLD-V236-A-4002' WHERE turbine_id = '10000000-0026-4000-8000-000000000026' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V236-B-4002' WHERE turbine_id = '10000000-0026-4000-8000-000000000026' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V236-C-4002' WHERE turbine_id = '10000000-0026-4000-8000-000000000026' AND position = 3;
UPDATE blade SET serial_number = 'BLD-V236-A-4003' WHERE turbine_id = '10000000-0027-4000-8000-000000000027' AND position = 1;
UPDATE blade SET serial_number = 'BLD-V236-B-4003' WHERE turbine_id = '10000000-0027-4000-8000-000000000027' AND position = 2;
UPDATE blade SET serial_number = 'BLD-V236-C-4003' WHERE turbine_id = '10000000-0027-4000-8000-000000000027' AND position = 3;
