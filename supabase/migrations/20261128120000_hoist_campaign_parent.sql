-- Hoist certification: one PARENT campaign holds many turbines.
--
-- Until now every hoist-certification campaign was ONE turbine
-- (campaign.turbine_id) and the mobile app writes items/photos by campaign_id.
-- To keep the mobile app unchanged, each turbine keeps its own campaign row
-- (type='hoist_certification', the "child") and a new PARENT row groups them:
--   - parent: type='hoist_certification_group', turbine_id = null
--   - child : type='hoist_certification', parent_campaign_id = parent.id
-- A wind farm can have many parent campaigns over time; each parent can have
-- any number of turbines. Deleting a parent deletes its children (and their
-- items/photos, already ON DELETE CASCADE from campaign).

alter table public.campaign
  add column if not exists parent_campaign_id uuid
  references public.campaign(id) on delete cascade;

create index if not exists campaign_parent_campaign_id_idx
  on public.campaign (parent_campaign_id);

-- Allow the parent type. All previous values are kept.
alter table public.campaign drop constraint if exists campaign_type_check;
alter table public.campaign
  add constraint campaign_type_check
  check (type in ('inspection', 'repair', 'cleaning', 'hoist_certification', 'hoist_certification_group'));

-- Merge the existing hoist campaigns: ONE parent per wind farm holding every
-- hoist campaign of that farm that has no parent yet. The parent takes the most
-- used name among them and the oldest creation date. Idempotent: children that
-- already have a parent are left alone. Nothing is deleted.
do $$
declare
  wf record;
  parent_id uuid;
begin
  for wf in
    select c.wind_farm_id,
           (select c2.name from public.campaign c2
             where c2.wind_farm_id = c.wind_farm_id
               and c2.type = 'hoist_certification'
               and c2.parent_campaign_id is null
             group by c2.name
             order by count(*) desc, min(c2.created_at)
             limit 1) as name,
           min(c.created_at) as created_at,
           bool_and(c.status = 'hoist_done') as all_done,
           bool_or(c.status in ('hoist_in_progress', 'hoist_done')) as any_started,
           (array_agg(c.created_by order by c.created_at))[1] as created_by
      from public.campaign c
     where c.type = 'hoist_certification'
       and c.parent_campaign_id is null
     group by c.wind_farm_id
  loop
    insert into public.campaign (wind_farm_id, name, type, status, created_at, created_by)
    values (
      wf.wind_farm_id,
      wf.name,
      'hoist_certification_group',
      case when wf.all_done then 'hoist_done'
           when wf.any_started then 'hoist_in_progress'
           else 'hoist_open' end,
      wf.created_at,
      wf.created_by
    )
    returning id into parent_id;

    update public.campaign
       set parent_campaign_id = parent_id
     where wind_farm_id = wf.wind_farm_id
       and type = 'hoist_certification'
       and parent_campaign_id is null;
  end loop;
end $$;
