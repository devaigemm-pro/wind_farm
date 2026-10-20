-- Allow 'cleaning' campaigns ("Limpieza de Turbina").
--
-- ROOT CAUSE: the campaign table has two CHECK constraints:
--   - campaign_type_check   → type   in ('inspection', 'repair')
--   - campaign_status_check → status in ('awaiting_photos', 'photos_uploaded',
--       'annotating', 'completed', 'repair_open', 'repair_in_progress', 'repair_done')
-- The new cleaning flow inserts a campaign with type='cleaning' and
-- status='cleaning_open', so the insert failed with error 23514 (check
-- constraint violation) and the UI showed "No se pudo crear la campaña de
-- limpieza". Same class of issue as report_type_repair.sql (adding 'repair').
--
-- Widen both constraints to include the cleaning values. All previously allowed
-- values are preserved so inspection and repair keep working.

alter table public.campaign drop constraint if exists campaign_type_check;
alter table public.campaign
  add constraint campaign_type_check
  check (type in ('inspection', 'repair', 'cleaning'));

alter table public.campaign drop constraint if exists campaign_status_check;
alter table public.campaign
  add constraint campaign_status_check
  check (status in (
    'awaiting_photos', 'photos_uploaded', 'annotating', 'completed',
    'repair_open', 'repair_in_progress', 'repair_done',
    'cleaning_open', 'cleaning_in_progress', 'cleaning_done'
  ));
