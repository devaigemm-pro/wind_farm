-- Migration: get_repair_photo_uploaders() RPC
--
-- The Repairs screen (/repairs/:campaignId) shows a "Cargado por: {name}" label
-- per photo. It used to source that name from repair_photos_detailed.technician_name,
-- which is the technician ASSIGNED to the repair (repair.technician_id) — NOT the
-- user who actually uploaded the photo from the mobile app. In ~93% of photos those
-- differ, so the label was wrong.
--
-- The real uploader per photo is storage.objects.owner_id of the 'inspection-photos'
-- bucket, matched by storage.objects.name = repair_photo.storage_path. owner_id is
-- TEXT and must be cast to uuid, then resolved to a name in public.profiles.
--
-- The `storage` schema is NOT exposed to PostgREST (only `public` and
-- `graphql_public`), so the frontend can't read storage.objects directly with
-- supabase-js. This SECURITY DEFINER RPC in the `public` schema bridges that gap,
-- following the same pattern as the existing repair RPCs.
--
-- Style follows 20260714000001_wind_farms_dashboard.sql (language sql + returns
-- table + security definer) and 20260916000001_create_wind_farm_rpc.sql (grants).

create or replace function public.get_repair_photo_uploaders(photo_ids uuid[])
returns table(photo_id uuid, uploader_name text)
language sql
security definer
set search_path = public, storage
as $$
  select
    rp.id as photo_id,
    -- Real uploader (storage.objects.owner_id) with fallback to the assigned technician.
    coalesce(powner.name, ptech.name) as uploader_name
  from public.repair_photo rp
  -- Real uploader: match the stored object by path in the inspection-photos bucket.
  left join storage.objects o
    on o.bucket_id = 'inspection-photos'
   and o.name = rp.storage_path
  left join public.profiles powner
    on powner.id = o.owner_id::uuid
  -- Fallback: the technician assigned to the repair.
  left join public.repair r
    on r.id = rp.repair_id
  left join public.profiles ptech
    on ptech.id = r.technician_id
  where rp.id = any(photo_ids);
$$;

-- Called from the app for both anon and signed-in users, like the other repair RPCs.
grant execute on function public.get_repair_photo_uploaders(uuid[]) to anon, authenticated;
