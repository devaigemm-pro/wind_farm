-- Migration: MULTI-ROLE support
--
-- Historically a user had a single role in profiles.role, consumed by:
--   * SQL helper get_user_role() (used by 14 RLS policies)
--   * Edge Functions (profile.role !== 'x')
--   * frontend useAuth().role
--
-- This migration introduces public.user_roles (one row per user+role). Permissions
-- now SUM: a user is allowed anything ANY of their roles allows. Design is fully
-- backwards compatible:
--   * profiles.role is kept (populated with the primary role) for display/compat.
--   * get_user_role() is kept (now returns a representative role from user_roles).
--   * A new helper user_has_any_role(text[]) is the primary role check for RLS.
--
-- Style follows 20260713000001_harden_functions.sql (security definer + stable +
-- set search_path = '') and 20260713000002_optimize_rls.sql (initplan `(select ...)`).

----------------------------------------------------------------------
-- 1. user_roles table
----------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role varchar not null check (role in (
    'inspector',
    'supervisor',
    'admin',
    'client',
    'technician',
    'analyst_ss',
    'analyst_sr'
  )),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create index if not exists idx_user_roles_user on public.user_roles(user_id);

----------------------------------------------------------------------
-- 2. Migrate existing data: copy each profile's current role.
----------------------------------------------------------------------
insert into public.user_roles (user_id, role)
select id, role from public.profiles where role is not null
on conflict (user_id, role) do nothing;

----------------------------------------------------------------------
-- 3. Helpers (hardened like get_user_role: security definer + stable +
--    empty search_path with fully-qualified identifiers).
----------------------------------------------------------------------

-- Primary RLS check: does the current user have ANY of `roles`?
-- SECURITY DEFINER reads user_roles bypassing its RLS, so there is NO infinite
-- recursion when this helper is used inside user_roles' own policies.
create or replace function public.user_has_any_role(roles text[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = any(roles)
  );
$$;

revoke execute on function public.user_has_any_role(text[]) from public, anon;
grant  execute on function public.user_has_any_role(text[]) to authenticated;

-- Full array of the current user's roles (for the frontend / rpc if needed).
create or replace function public.user_roles_array()
returns text[]
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(array_agg(role), '{}') from public.user_roles where user_id = auth.uid();
$$;

revoke execute on function public.user_roles_array() from public, anon;
grant  execute on function public.user_roles_array() to authenticated;

-- Keep get_user_role() for compat, but source it from user_roles so it stays
-- consistent after the migration. Returns a representative single role.
create or replace function public.get_user_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.user_roles where user_id = auth.uid() limit 1;
$$;

revoke execute on function public.get_user_role() from public, anon;
grant  execute on function public.get_user_role() to authenticated;

----------------------------------------------------------------------
-- 4. RLS on user_roles.
--    SELECT: a user sees their own roles; admins see all.
--    INSERT/UPDATE/DELETE: admin only.
--    No recursion: user_has_any_role is SECURITY DEFINER and bypasses RLS
--    when reading user_roles.
----------------------------------------------------------------------
drop policy if exists "Users read own roles" on public.user_roles;
create policy "Users read own roles"
  on public.user_roles for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.user_has_any_role(array['admin']))
  );

drop policy if exists "Admins insert roles" on public.user_roles;
create policy "Admins insert roles"
  on public.user_roles for insert
  to authenticated
  with check ((select public.user_has_any_role(array['admin'])));

drop policy if exists "Admins update roles" on public.user_roles;
create policy "Admins update roles"
  on public.user_roles for update
  to authenticated
  using      ((select public.user_has_any_role(array['admin'])))
  with check ((select public.user_has_any_role(array['admin'])));

drop policy if exists "Admins delete roles" on public.user_roles;
create policy "Admins delete roles"
  on public.user_roles for delete
  to authenticated
  using ((select public.user_has_any_role(array['admin'])));

----------------------------------------------------------------------
-- 5. Rewrite the 14 role-based policies from get_user_role() to
--    user_has_any_role(array[...]). SELECT policies gated by
--    user_can_access_farm are intentionally left untouched.
----------------------------------------------------------------------

-- === WIND_FARM (insert/update/delete → supervisor,admin) ===
drop policy if exists "Supervisors and admins can insert wind farms" on public.wind_farm;
create policy "Supervisors and admins can insert wind farms"
  on public.wind_farm for insert
  to authenticated
  with check ((select public.user_has_any_role(array['supervisor','admin'])));

drop policy if exists "Supervisors and admins can update wind farms" on public.wind_farm;
create policy "Supervisors and admins can update wind farms"
  on public.wind_farm for update
  to authenticated
  using ((select public.user_has_any_role(array['supervisor','admin'])));

drop policy if exists "Supervisors and admins can delete wind farms" on public.wind_farm;
create policy "Supervisors and admins can delete wind farms"
  on public.wind_farm for delete
  to authenticated
  using ((select public.user_has_any_role(array['supervisor','admin'])));

-- === TURBINE (insert/update/delete → supervisor,admin) ===
drop policy if exists "Supervisors and admins can insert turbines" on public.turbine;
create policy "Supervisors and admins can insert turbines"
  on public.turbine for insert
  to authenticated
  with check ((select public.user_has_any_role(array['supervisor','admin'])));

drop policy if exists "Supervisors and admins can update turbines" on public.turbine;
create policy "Supervisors and admins can update turbines"
  on public.turbine for update
  to authenticated
  using ((select public.user_has_any_role(array['supervisor','admin'])));

drop policy if exists "Supervisors and admins can delete turbines" on public.turbine;
create policy "Supervisors and admins can delete turbines"
  on public.turbine for delete
  to authenticated
  using ((select public.user_has_any_role(array['supervisor','admin'])));

-- === INSPECTION (insert → inspector,supervisor,admin; update → own in-progress OR supervisor,admin) ===
drop policy if exists "Inspectors can create inspections" on public.inspection;
create policy "Inspectors can create inspections"
  on public.inspection for insert
  to authenticated
  with check ((select public.user_has_any_role(array['inspector','supervisor','admin'])));

drop policy if exists "Inspectors can update their own in-progress inspections" on public.inspection;
create policy "Inspectors can update their own in-progress inspections"
  on public.inspection for update
  to authenticated
  using (
    (inspector_id = (select auth.uid()) and status = 'in_progress')
    or (select public.user_has_any_role(array['supervisor','admin']))
  );

-- === CAMPAIGN (FOR ALL → supervisor,admin) ===
drop policy if exists "Supervisors and admins can manage campaigns" on public.campaign;
create policy "Supervisors and admins can manage campaigns"
  on public.campaign for all
  to authenticated
  using (true)
  with check ((select public.user_has_any_role(array['supervisor','admin'])));

-- === ASSET_DOCUMENT (FOR ALL → supervisor,admin) ===
drop policy if exists "Supervisors and admins can manage asset documents" on public.asset_document;
create policy "Supervisors and admins can manage asset documents"
  on public.asset_document for all
  to authenticated
  using (true)
  with check ((select public.user_has_any_role(array['supervisor','admin'])));

-- === WIND_FARM_USER (4 policies → admin) ===
drop policy if exists "Users read own farm assignments" on public.wind_farm_user;
create policy "Users read own farm assignments"
  on public.wind_farm_user for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.user_has_any_role(array['admin']))
  );

drop policy if exists "Admins insert farm assignments" on public.wind_farm_user;
create policy "Admins insert farm assignments"
  on public.wind_farm_user for insert
  to authenticated
  with check ((select public.user_has_any_role(array['admin'])));

drop policy if exists "Admins update farm assignments" on public.wind_farm_user;
create policy "Admins update farm assignments"
  on public.wind_farm_user for update
  to authenticated
  using      ((select public.user_has_any_role(array['admin'])))
  with check ((select public.user_has_any_role(array['admin'])));

drop policy if exists "Admins delete farm assignments" on public.wind_farm_user;
create policy "Admins delete farm assignments"
  on public.wind_farm_user for delete
  to authenticated
  using ((select public.user_has_any_role(array['admin'])));

-- === STORAGE.OBJECTS evidence bucket (insert → inspector,supervisor,admin) ===
drop policy if exists "Inspectors can upload evidence" on storage.objects;
create policy "Inspectors can upload evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and (select public.user_has_any_role(array['inspector','supervisor','admin']))
  );

----------------------------------------------------------------------
-- 6. handle_new_user(): keep populating profiles (role = primary), and
--    also seed user_roles with the initial role.
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

  insert into public.user_roles (user_id, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'role', 'inspector'))
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;
