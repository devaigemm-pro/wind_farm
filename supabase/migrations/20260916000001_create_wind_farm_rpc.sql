-- Migration: create_wind_farm() atomic RPC
--
-- Fixes a 403 on POST /admin/assets when creating a NEW wind farm.
--
-- Root cause: assetsService.createWindFarm did
--   insert(...).select().single()
-- The INSERT passes RLS (supervisor/admin), but the trailing .select() that
-- returns the new row is evaluated against the wind_farm SELECT policy
-- (user_can_access_farm(id)), which requires a matching wind_farm_user
-- assignment. That assignment was inserted AFTERWARDS in a separate request,
-- so the .select() returned 0 rows and .single() failed with 403 — a classic
-- RLS insert→select→assign race.
--
-- Fix: perform insert + self-assignment atomically in ONE transaction inside a
-- SECURITY DEFINER function, then return the created row. The definer context
-- bypasses the SELECT policy so the freshly-created row is always returned.
--
-- Style follows 20260713000001_harden_functions.sql (security definer +
-- set search_path fixed) and 20260910000003_multi_role.sql (user_has_any_role).

create or replace function public.create_wind_farm(
  p_name      varchar,
  p_location  varchar,
  p_country   varchar default null,
  p_client    varchar default null,
  p_latitude  decimal default null,
  p_longitude decimal default null
)
returns public.wind_farm
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm public.wind_farm;
begin
  -- 1. Authorization: only supervisors/admins may create wind farms.
  if not public.user_has_any_role(array['admin', 'supervisor']) then
    raise exception 'insufficient_privilege: only admins or supervisors can create wind farms'
      using errcode = '42501';
  end if;

  -- 2. Insert the wind farm row.
  insert into public.wind_farm (name, location, country, client, latitude, longitude)
  values (p_name, p_location, p_country, p_client, p_latitude, p_longitude)
  returning * into v_farm;

  -- 3. Self-assign so the creator can immediately read the farm through RLS.
  insert into public.wind_farm_user (wind_farm_id, user_id)
  values (v_farm.id, auth.uid())
  on conflict do nothing;

  -- 4. Return the created row (bypasses SELECT RLS via SECURITY DEFINER).
  return v_farm;
end;
$$;

-- Only signed-in users may call it; the body enforces the role check.
revoke execute on function public.create_wind_farm(varchar, varchar, varchar, varchar, decimal, decimal) from public, anon;
grant  execute on function public.create_wind_farm(varchar, varchar, varchar, varchar, decimal, decimal) to authenticated;
