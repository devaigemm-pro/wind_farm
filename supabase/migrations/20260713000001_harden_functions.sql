-- Harden functions per Supabase advisors:
--   0011 function_search_path_mutable  -> set search_path = '' on every function
--   0028 anon_security_definer_function_executable
--   0029 authenticated_security_definer_function_executable
--
-- Bodies are re-declared with fully-qualified identifiers so the empty
-- search_path never breaks resolution. Trigger-only functions have their
-- EXECUTE privilege revoked from all roles (triggers themselves are
-- invoked by the trigger owner and do not depend on caller EXECUTE).
-- get_user_role() is referenced from RLS policies so it must remain
-- executable by `authenticated`.

----------------------------------------------------------------------
-- Trigger function: auto-create 3 blades on new turbine
----------------------------------------------------------------------
create or replace function public.create_blades_for_turbine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.blade (turbine_id, position)
  values (new.id, 1), (new.id, 2), (new.id, 3);
  return new;
end;
$$;

----------------------------------------------------------------------
-- Trigger function: auto-create profile row for a new auth.users row
----------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'inspector')
  );
  return new;
end;
$$;

----------------------------------------------------------------------
-- Trigger function: touch updated_at column
----------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

----------------------------------------------------------------------
-- Helper for RLS: current user's role. Stays SECURITY DEFINER because
-- callers (via RLS) must be able to see profiles.role even when the
-- profiles SELECT policy would otherwise restrict them. auth.uid()
-- inside the body ensures each caller can only read their own row.
----------------------------------------------------------------------
create or replace function public.get_user_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

----------------------------------------------------------------------
-- Lock down EXECUTE on the trigger-only functions. Triggers run as the
-- function owner (postgres) so revoking from all roles does not disable
-- them; it only removes the /rest/v1/rpc/... surface.
----------------------------------------------------------------------
revoke execute on function public.create_blades_for_turbine() from public, anon, authenticated;
revoke execute on function public.handle_new_user()           from public, anon, authenticated;
revoke execute on function public.set_updated_at()            from public, anon, authenticated;

----------------------------------------------------------------------
-- get_user_role must remain callable by signed-in users because RLS
-- policies invoke it via `public.get_user_role()`. Anon has no use
-- for it and is explicitly revoked.
----------------------------------------------------------------------
revoke execute on function public.get_user_role() from public, anon;
grant  execute on function public.get_user_role() to authenticated;
