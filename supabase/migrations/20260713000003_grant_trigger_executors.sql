-- Postgres 15+ requires the OWNER of a trigger's table to have EXECUTE
-- on the trigger function, even for SECURITY DEFINER functions. The
-- previous hardening migration revoked EXECUTE from `public`, which
-- removed the inherited grant that `supabase_auth_admin` (owner of
-- `auth.users`) needs to fire the `on_auth_user_created` trigger.
-- Without this grant, GoTrue's login flow fails with
-- "Database error querying schema".

grant execute on function public.handle_new_user()           to supabase_auth_admin;

-- The `postgres` role owns public.* tables and has bypass privileges,
-- but grant explicitly for defence-in-depth on the trigger functions
-- attached to public tables.
grant execute on function public.set_updated_at()            to postgres;
grant execute on function public.create_blades_for_turbine() to postgres;
