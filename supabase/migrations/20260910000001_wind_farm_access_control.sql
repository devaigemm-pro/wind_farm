-- Migration: Wind farm access control (per-user farm assignment) + user maintainer support
--
-- Business rule: every authenticated user (admins included) only sees the wind
-- farms they are explicitly assigned to. Without an assignment a user can neither
-- list a farm nor reach it through a direct link, because the SELECT policies on
-- wind_farm and all of its child tables (turbine, blade, inspection, evidence,
-- defect, defect_image) now check the assignment via user_can_access_farm().
--
-- Style follows 20260713000001_harden_functions.sql (security definer + stable +
-- set search_path = '') and 20260713000002_optimize_rls.sql (initplan `(select ...)`
-- wrapping so auth.uid()/helpers evaluate once per query).
--
-- Only SELECT policies are replaced. INSERT/UPDATE/DELETE policies (role based)
-- are left intact.

----------------------------------------------------------------------
-- 1. Profiles: add last_name + rut (rut unique but tolerant of nulls)
----------------------------------------------------------------------
alter table public.profiles add column if not exists last_name varchar;
alter table public.profiles add column if not exists rut varchar;

create unique index if not exists profiles_rut_key
  on public.profiles(rut) where rut is not null;

----------------------------------------------------------------------
-- 2. Assignment table: which users can access which wind farms
----------------------------------------------------------------------
create table if not exists public.wind_farm_user (
  wind_farm_id uuid not null references public.wind_farm(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wind_farm_id, user_id)
);

alter table public.wind_farm_user enable row level security;

-- Helpful lookup index for the RLS helper (user_id → farms).
create index if not exists idx_wind_farm_user_user on public.wind_farm_user (user_id);

----------------------------------------------------------------------
-- 3. Helper: does the current user have an assignment to `farm`?
--    Hardened like the other helpers (security definer + stable +
--    empty search_path with fully-qualified identifiers).
----------------------------------------------------------------------
create or replace function public.user_can_access_farm(farm uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.wind_farm_user
    where wind_farm_id = farm and user_id = auth.uid()
  );
$$;

-- RLS policies invoke this helper, so it must remain callable by signed-in
-- users. Anon has no use for it.
revoke execute on function public.user_can_access_farm(uuid) from public, anon;
grant  execute on function public.user_can_access_farm(uuid) to authenticated;

----------------------------------------------------------------------
-- 4. RLS on wind_farm_user
----------------------------------------------------------------------
-- SELECT: a user sees their own assignments; admins see all.
drop policy if exists "Users read own farm assignments" on public.wind_farm_user;
create policy "Users read own farm assignments"
  on public.wind_farm_user for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.get_user_role()) = 'admin'
  );

-- INSERT/UPDATE/DELETE: admin only.
drop policy if exists "Admins insert farm assignments" on public.wind_farm_user;
create policy "Admins insert farm assignments"
  on public.wind_farm_user for insert
  to authenticated
  with check ((select public.get_user_role()) = 'admin');

drop policy if exists "Admins update farm assignments" on public.wind_farm_user;
create policy "Admins update farm assignments"
  on public.wind_farm_user for update
  to authenticated
  using      ((select public.get_user_role()) = 'admin')
  with check ((select public.get_user_role()) = 'admin');

drop policy if exists "Admins delete farm assignments" on public.wind_farm_user;
create policy "Admins delete farm assignments"
  on public.wind_farm_user for delete
  to authenticated
  using ((select public.get_user_role()) = 'admin');

----------------------------------------------------------------------
-- 5. wind_farm SELECT: replace `using(true)` with assignment check.
--    NOTE: no admin bypass here — per requirement, admins also need an
--    assignment to VIEW farms. Admins still manage everything via the
--    user maintainer (Edge Function using the service role).
----------------------------------------------------------------------
drop policy if exists "All authenticated users can read wind farms" on public.wind_farm;
create policy "Users read assigned wind farms"
  on public.wind_farm for select
  to authenticated
  using ((select public.user_can_access_farm(id)));

----------------------------------------------------------------------
-- 6. Child tables: SELECT gated by the assignment of the parent farm.
--    Only SELECT policies change. INSERT/UPDATE/DELETE stay as they are.
----------------------------------------------------------------------

-- TURBINE — parent farm is turbine.wind_farm_id
drop policy if exists "All authenticated users can read turbines" on public.turbine;
create policy "Users read turbines of assigned farms"
  on public.turbine for select
  to authenticated
  using ((select public.user_can_access_farm(wind_farm_id)));

-- BLADE — farm resolved through the owning turbine
drop policy if exists "All authenticated users can read blades" on public.blade;
create policy "Users read blades of assigned farms"
  on public.blade for select
  to authenticated
  using (
    exists (
      select 1 from public.turbine t
      where t.id = blade.turbine_id
        and (select public.user_can_access_farm(t.wind_farm_id))
    )
  );

-- INSPECTION — dual path: via blade.turbine OR via the direct turbine_id
drop policy if exists "All authenticated users can read inspections" on public.inspection;
create policy "Users read inspections of assigned farms"
  on public.inspection for select
  to authenticated
  using (
    exists (
      select 1 from public.blade b
      join public.turbine t on t.id = b.turbine_id
      where b.id = inspection.blade_id
        and (select public.user_can_access_farm(t.wind_farm_id))
    )
    or (
      inspection.turbine_id is not null
      and exists (
        select 1 from public.turbine t2
        where t2.id = inspection.turbine_id
          and (select public.user_can_access_farm(t2.wind_farm_id))
      )
    )
  );

-- EVIDENCE — via evidence.inspection_id → same dual inspection chain
drop policy if exists "All authenticated users can read evidence" on public.evidence;
create policy "Users read evidence of assigned farms"
  on public.evidence for select
  to authenticated
  using (
    exists (
      select 1 from public.inspection i
      where i.id = evidence.inspection_id
        and (
          exists (
            select 1 from public.blade b
            join public.turbine t on t.id = b.turbine_id
            where b.id = i.blade_id
              and (select public.user_can_access_farm(t.wind_farm_id))
          )
          or (
            i.turbine_id is not null
            and exists (
              select 1 from public.turbine t2
              where t2.id = i.turbine_id
                and (select public.user_can_access_farm(t2.wind_farm_id))
            )
          )
        )
    )
  );

-- DEFECT — via defect.inspection_id → same dual inspection chain
drop policy if exists "All authenticated users can read defects" on public.defect;
create policy "Users read defects of assigned farms"
  on public.defect for select
  to authenticated
  using (
    exists (
      select 1 from public.inspection i
      where i.id = defect.inspection_id
        and (
          exists (
            select 1 from public.blade b
            join public.turbine t on t.id = b.turbine_id
            where b.id = i.blade_id
              and (select public.user_can_access_farm(t.wind_farm_id))
          )
          or (
            i.turbine_id is not null
            and exists (
              select 1 from public.turbine t2
              where t2.id = i.turbine_id
                and (select public.user_can_access_farm(t2.wind_farm_id))
            )
          )
        )
    )
  );

-- DEFECT_IMAGE — via defect_image.defect_id → defect.inspection_id → chain
drop policy if exists "All authenticated users can read defect images" on public.defect_image;
create policy "Users read defect images of assigned farms"
  on public.defect_image for select
  to authenticated
  using (
    exists (
      select 1 from public.defect d
      join public.inspection i on i.id = d.inspection_id
      where d.id = defect_image.defect_id
        and (
          exists (
            select 1 from public.blade b
            join public.turbine t on t.id = b.turbine_id
            where b.id = i.blade_id
              and (select public.user_can_access_farm(t.wind_farm_id))
          )
          or (
            i.turbine_id is not null
            and exists (
              select 1 from public.turbine t2
              where t2.id = i.turbine_id
                and (select public.user_can_access_farm(t2.wind_farm_id))
            )
          )
        )
    )
  );

----------------------------------------------------------------------
-- 7. handle_new_user(): also copy last_name + rut from user metadata.
--    Keeps the hardened style (security definer + empty search_path).
----------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, last_name, rut, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'rut',
    coalesce(new.raw_user_meta_data->>'role', 'inspector')
  );
  return new;
end;
$$;
