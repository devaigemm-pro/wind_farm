-- Migration: allow deleting users with history by preserving their records.
--
-- Business decision: a user can be deleted even if they authored inspections,
-- reports, etc. Those records are KEPT; the author reference is set to NULL
-- (option B — desvincular). No inspection data is lost, only the "who did it".
--
-- To allow NULL we must (1) make the previously NOT NULL author columns
-- nullable, and (2) recreate the FKs with ON DELETE SET NULL.

----------------------------------------------------------------------
-- 1. Make author columns nullable (were NOT NULL)
----------------------------------------------------------------------
alter table public.inspection    alter column inspector_id drop not null;
alter table public.report         alter column generated_by drop not null;
alter table public.defect_comment alter column author_id    drop not null;

----------------------------------------------------------------------
-- 2. Recreate FKs to profiles with ON DELETE SET NULL
----------------------------------------------------------------------

-- inspection.inspector_id
alter table public.inspection drop constraint if exists inspection_inspector_id_fkey;
alter table public.inspection
  add constraint inspection_inspector_id_fkey
  foreign key (inspector_id) references public.profiles(id) on delete set null;

-- inspection.approved_by
alter table public.inspection drop constraint if exists inspection_approved_by_fkey;
alter table public.inspection
  add constraint inspection_approved_by_fkey
  foreign key (approved_by) references public.profiles(id) on delete set null;

-- report.generated_by
alter table public.report drop constraint if exists report_generated_by_fkey;
alter table public.report
  add constraint report_generated_by_fkey
  foreign key (generated_by) references public.profiles(id) on delete set null;

-- campaign.created_by
alter table public.campaign drop constraint if exists campaign_created_by_fkey;
alter table public.campaign
  add constraint campaign_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- asset_document.uploaded_by
alter table public.asset_document drop constraint if exists asset_document_uploaded_by_fkey;
alter table public.asset_document
  add constraint asset_document_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(id) on delete set null;

-- defect_comment.author_id
alter table public.defect_comment drop constraint if exists defect_comment_author_id_fkey;
alter table public.defect_comment
  add constraint defect_comment_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

-- repair.technician_id
alter table public.repair drop constraint if exists repair_technician_id_fkey;
alter table public.repair
  add constraint repair_technician_id_fkey
  foreign key (technician_id) references public.profiles(id) on delete set null;
