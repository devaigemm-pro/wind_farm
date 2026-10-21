-- Allow 'hoist_certification' campaigns ("Certificación de polipastos").
--
-- ROOT CAUSE: the campaign table has two CHECK constraints:
--   - campaign_type_check   → type   in ('inspection', 'repair', 'cleaning')
--   - campaign_status_check → status in ('awaiting_photos', 'photos_uploaded',
--       'annotating', 'completed', 'repair_open', 'repair_in_progress',
--       'repair_done', 'cleaning_open', 'cleaning_in_progress', 'cleaning_done')
-- The new hoist-certification flow inserts a campaign with
-- type='hoist_certification' and status='hoist_open', so the insert would fail
-- with error 23514 (check constraint violation) and the UI would show "No se
-- pudo crear la campaña de certificación". Same class of issue as
-- 20261019000001_campaign_type_status_cleaning.sql (adding 'cleaning').
--
-- Widen both constraints to include the hoist values. All previously allowed
-- values are preserved so inspection, repair and cleaning keep working.

alter table public.campaign drop constraint if exists campaign_type_check;
alter table public.campaign
  add constraint campaign_type_check
  check (type in ('inspection', 'repair', 'cleaning', 'hoist_certification'));

alter table public.campaign drop constraint if exists campaign_status_check;
alter table public.campaign
  add constraint campaign_status_check
  check (status in (
    'awaiting_photos', 'photos_uploaded', 'annotating', 'completed',
    'repair_open', 'repair_in_progress', 'repair_done',
    'cleaning_open', 'cleaning_in_progress', 'cleaning_done',
    'hoist_open', 'hoist_in_progress', 'hoist_done'
  ));
