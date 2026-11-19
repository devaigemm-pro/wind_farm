-- Migration: delete_wind_farm_cascade()
--
-- Deleting a wind farm failed with "Cannot delete: this asset has linked
-- inspections": wind_farm -> turbine -> blade -> inspection (and campaigns,
-- defects, quotes, repairs, cleaning, hoist certification, reports ...) are
-- ON DELETE RESTRICT / NO ACTION, so Postgres refuses to remove a farm that has
-- any data under it.
--
-- This adds an admin-only RPC that removes a wind farm TOGETHER WITH everything
-- that hangs from it, in ONE transaction (all or nothing).
--
--   delete_wind_farm_cascade(p_wind_farm_id uuid, p_dry_run boolean default false)
--     returns jsonb { name, dry_run, counts: { <table>: <rows deleted> } }
--
--   * p_dry_run = true performs the whole deletion inside a sub-transaction and
--     rolls it back, so the UI can show "this will delete N turbines, M
--     inspections ..." BEFORE the user confirms. Nothing is changed.
--   * Only role 'admin' may call it (checked inside; SECURITY DEFINER bypasses
--     RLS, so the check is the only gate).
--
-- Why a generic walk and not a fixed table list: several tables that reference
-- the farm (repair, quote, work_order, cleaning_*, hoist_cert_*) are owned by the
-- mobile team and are NOT defined in this repo's migrations, so a hard-coded list
-- would silently miss some and leave the delete failing. Instead the function
-- follows pg_constraint: for every foreign key that points at the rows being
-- deleted (ON DELETE NO ACTION / RESTRICT / CASCADE) it deletes the referencing
-- rows first, depth first. FKs with ON DELETE SET NULL / SET DEFAULT are left to
-- Postgres. If it meets a shape it cannot handle safely (composite or non-PK
-- foreign key) it raises and the transaction rolls back untouched.
--
-- NOT covered: files in Storage buckets (photos, PDFs) are not removed; they stay
-- as unreferenced objects. Deleting storage.objects rows from SQL does not delete
-- the underlying file, so that cleanup is left to the Storage API.

-- ─── Internal helper: delete every row that depends on p_ids of p_table ───────
create or replace function public._cascade_delete_rows(
  p_table  regclass,
  p_ids    text[],
  p_depth  int,
  p_counts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_fk            record;
  v_parent_pk     int2;
  v_child_pk      name;
  v_child_pk_type text;
  v_fk_col        name;
  v_fk_type       text;
  v_child_ids     text[];
  v_n             bigint;
begin
  if p_depth > 25 then
    raise exception 'cascade delete aborted: dependency chain deeper than 25 levels (cycle?)';
  end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then
    return p_counts;
  end if;

  -- The parent's single-column primary key (the column the FKs must reference).
  select i.indkey[0] into v_parent_pk
    from pg_index i
   where i.indrelid = p_table and i.indisprimary and i.indnatts = 1;
  if v_parent_pk is null then
    raise exception 'cascade delete aborted: % has no single-column primary key', p_table;
  end if;

  for v_fk in
    select c.conrelid, c.conname, c.conkey, c.confkey
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid = p_table
       and c.confdeltype in ('a', 'r', 'c')   -- no action, restrict, cascade
  loop
    if array_length(v_fk.conkey, 1) <> 1 or v_fk.confkey[1] <> v_parent_pk then
      raise exception 'cascade delete aborted: foreign key % is composite or does not reference the primary key', v_fk.conname;
    end if;

    select a.attname, format_type(a.atttypid, a.atttypmod)
      into v_fk_col, v_fk_type
      from pg_attribute a
     where a.attrelid = v_fk.conrelid and a.attnum = v_fk.conkey[1];

    -- Child's single-column primary key (null for link tables without one).
    select a.attname, format_type(a.atttypid, a.atttypmod)
      into v_child_pk, v_child_pk_type
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = v_fk.conrelid and i.indisprimary and i.indnatts = 1;

    if v_child_pk is null then
      -- No single-column PK. If something references this table we cannot walk
      -- further safely; otherwise just delete the rows pointing at the parent.
      if exists (select 1 from pg_constraint where contype = 'f' and confrelid = v_fk.conrelid) then
        raise exception 'cascade delete aborted: % is referenced but has no single-column primary key', v_fk.conrelid::regclass;
      end if;
      execute format('delete from %s where %I = any($1::%s[])', v_fk.conrelid::regclass, v_fk_col, v_fk_type)
        using p_ids;
      get diagnostics v_n = row_count;
    else
      execute format('select coalesce(array_agg(%I::text), ''{}'') from %s where %I = any($1::%s[])',
                     v_child_pk, v_fk.conrelid::regclass, v_fk_col, v_fk_type)
        into v_child_ids using p_ids;

      if coalesce(array_length(v_child_ids, 1), 0) = 0 then
        continue;
      end if;

      -- Grandchildren first, then these child rows.
      p_counts := public._cascade_delete_rows(v_fk.conrelid, v_child_ids, p_depth + 1, p_counts);
      execute format('delete from %s where %I = any($1::%s[])', v_fk.conrelid::regclass, v_child_pk, v_child_pk_type)
        using v_child_ids;
      get diagnostics v_n = row_count;
    end if;

    if v_n > 0 then
      p_counts := p_counts || jsonb_build_object(
        v_fk.conrelid::regclass::text,
        coalesce((p_counts ->> v_fk.conrelid::regclass::text)::bigint, 0) + v_n
      );
    end if;
  end loop;

  return p_counts;
end;
$$;

-- Internal only: nobody calls the helper through the API.
revoke all on function public._cascade_delete_rows(regclass, text[], int, jsonb)
  from public, anon, authenticated;

-- ─── Public RPC ────────────────────────────────────────────────────────────────
create or replace function public.delete_wind_farm_cascade(
  p_wind_farm_id uuid,
  p_dry_run      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_name   text;
  v_counts jsonb := '{}'::jsonb;
  v_n      bigint;
begin
  -- 1. Authorization: admins only.
  if not public.user_has_any_role(array['admin']) then
    raise exception 'insufficient_privilege: only admins can delete wind farms'
      using errcode = '42501';
  end if;

  select name into v_name from public.wind_farm where id = p_wind_farm_id;
  if not found then
    raise exception 'wind farm not found' using errcode = 'P0002';
  end if;

  -- 2. Delete everything under the farm, then the farm. The inner block is a
  --    sub-transaction: for a dry run we raise a private SQLSTATE at the end so
  --    every delete is rolled back, while v_counts (a PL variable) is kept.
  begin
    v_counts := public._cascade_delete_rows(
      'public.wind_farm'::regclass, array[p_wind_farm_id::text], 0, v_counts
    );
    delete from public.wind_farm where id = p_wind_farm_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('wind_farm', v_n);

    if p_dry_run then
      raise exception 'dry run rollback' using errcode = 'WF999';
    end if;
  exception
    when sqlstate 'WF999' then
      null;  -- expected: the dry run undid its own deletes
  end;

  return jsonb_build_object('name', v_name, 'dry_run', p_dry_run, 'counts', v_counts);
end;
$$;

revoke all on function public.delete_wind_farm_cascade(uuid, boolean) from public, anon;
grant execute on function public.delete_wind_farm_cascade(uuid, boolean) to authenticated;
