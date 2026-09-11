-- Migration: add analyst roles (Analista SS / Analista SR) to profiles.role check
--
-- Adds two new role values used by the user maintainer. Idempotent: drops and
-- recreates the check constraint with the full allowed set.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'inspector',
    'supervisor',
    'admin',
    'client',
    'technician',
    'analyst_ss',
    'analyst_sr'
  ));
