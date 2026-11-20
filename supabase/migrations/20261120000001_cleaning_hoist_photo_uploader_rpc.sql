-- Migration: get_cleaning_photo_uploaders() / get_hoist_photo_uploaders() RPCs
--
-- Same approach as get_repair_photo_uploaders (20260924000001): the real uploader of
-- a photo is storage.objects.owner_id of the 'inspection-photos' bucket, matched by
-- storage.objects.name = <table>.storage_path, resolved to profiles.name. The
-- `storage` schema is not exposed to PostgREST, so a SECURITY DEFINER RPC in `public`
-- bridges it. Cleaning/hoist have no "assigned technician", so there is no fallback:
-- photos without a storage owner return a null name (the UI shows "—").
create or replace function public.get_cleaning_photo_uploaders(photo_ids uuid[])
returns table(photo_id uuid, uploader_name text)
language sql
security definer
set search_path = public, storage
as $$
  select cp.id as photo_id, powner.name as uploader_name
  from public.cleaning_photo cp
  left join storage.objects o
    on o.bucket_id = 'inspection-photos'
   and o.name = cp.storage_path
  left join public.profiles powner
    on powner.id = o.owner_id::uuid
  where cp.id = any(photo_ids);
$$;
create or replace function public.get_hoist_photo_uploaders(photo_ids uuid[])
returns table(photo_id uuid, uploader_name text)
language sql
security definer
set search_path = public, storage
as $$
  select hp.id as photo_id, powner.name as uploader_name
  from public.hoist_cert_photo hp
  left join storage.objects o
    on o.bucket_id = 'inspection-photos'
   and o.name = hp.storage_path
  left join public.profiles powner
    on powner.id = o.owner_id::uuid
  where hp.id = any(photo_ids);
$$;
grant execute on function public.get_cleaning_photo_uploaders(uuid[]) to anon, authenticated;
grant execute on function public.get_hoist_photo_uploaders(uuid[]) to anon, authenticated;
