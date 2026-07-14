-- Migration: Create core tables for Wind Blade Inspection application
-- Tables: profiles, wind_farm, turbine, blade, inspection, evidence, defect, defect_image, report

----------------------------------------------------------------------
-- 1. Profiles table (synced from auth.users via trigger)
----------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar not null unique,
  name varchar not null,
  role varchar not null check (role in ('inspector', 'supervisor', 'admin')) default 'inspector',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- 2. Wind Farm table
----------------------------------------------------------------------
create table public.wind_farm (
  id uuid primary key default gen_random_uuid(),
  name varchar not null unique,
  location varchar not null,
  latitude decimal,
  longitude decimal,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- 3. Turbine table
----------------------------------------------------------------------
create table public.turbine (
  id uuid primary key default gen_random_uuid(),
  wind_farm_id uuid not null references public.wind_farm(id) on delete restrict,
  name varchar not null,
  model varchar,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- 4. Blade table
----------------------------------------------------------------------
create table public.blade (
  id uuid primary key default gen_random_uuid(),
  turbine_id uuid not null references public.turbine(id) on delete restrict,
  position int not null check (position between 1 and 3),
  serial_number varchar,
  length_meters decimal,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turbine_id, position)
);

----------------------------------------------------------------------
-- 5. Inspection table
----------------------------------------------------------------------
create table public.inspection (
  id uuid primary key default gen_random_uuid(),
  blade_id uuid not null references public.blade(id) on delete restrict,
  inspector_id uuid not null references public.profiles(id),
  status varchar not null check (status in ('in_progress', 'completed', 'approved')) default 'in_progress',
  stage varchar not null check (stage in ('to_plan', 'planned', 'uploaded', 'annotated', 'analyzed', 'finalized')) default 'to_plan',
  scheduled_date date not null,
  completed_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- 6. Evidence table
----------------------------------------------------------------------
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspection(id) on delete cascade,
  filename varchar not null,
  mime_type varchar not null check (mime_type in ('image/jpeg', 'image/png')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 20971520),
  storage_path varchar not null,
  geo_lat decimal,
  geo_lng decimal,
  uploaded_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- 7. Defect table
----------------------------------------------------------------------
create table public.defect (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspection(id) on delete cascade,
  type varchar not null check (type in ('le_erosion', 'vortex', 'paint_defect', 'crack', 'delamination', 'lightning_damage', 'other')),
  severity int not null check (severity between 1 and 5),
  distance_from_root decimal not null check (distance_from_root >= 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- 8. Defect-Image junction table
----------------------------------------------------------------------
create table public.defect_image (
  defect_id uuid not null references public.defect(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  primary key (defect_id, evidence_id)
);

----------------------------------------------------------------------
-- 9. Report table
----------------------------------------------------------------------
create table public.report (
  id uuid primary key default gen_random_uuid(),
  type varchar not null check (type in ('inspection', 'consolidated')),
  reference_id uuid not null,
  generated_by uuid not null references public.profiles(id),
  storage_path varchar not null,
  filename varchar not null,
  generated_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- 10. Indexes
----------------------------------------------------------------------

-- Inspection indexes
create index idx_inspection_blade_scheduled on public.inspection (blade_id, scheduled_date desc);
create index idx_inspection_status on public.inspection (status);
create index idx_inspection_stage on public.inspection (stage);
create index idx_inspection_inspector on public.inspection (inspector_id);

-- Defect indexes
create index idx_defect_inspection on public.defect (inspection_id);
create index idx_defect_type_severity on public.defect (type, severity);

-- Evidence indexes
create index idx_evidence_inspection on public.evidence (inspection_id);
