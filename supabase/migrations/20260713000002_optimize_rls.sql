-- Optimize RLS policies per Supabase advisor 0003_auth_rls_initplan:
--   Wrap `auth.uid()` and `public.get_user_role()` calls in a scalar
--   subquery `(select ...)` so Postgres evaluates them once per query
--   rather than once per row (initplan pattern).
--
-- Also add missing WITH CHECK clauses to UPDATE policies -- without
-- them a user could reassign ownership columns to another user, which
-- the Supabase security guide explicitly flags as a common footgun.

-- =========================================================
-- PROFILES
-- =========================================================
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- =========================================================
-- WIND_FARM
-- =========================================================
drop policy if exists "Supervisors and admins can insert wind farms" on public.wind_farm;
create policy "Supervisors and admins can insert wind farms"
  on public.wind_farm for insert
  to authenticated
  with check ((select public.get_user_role()) in ('supervisor', 'admin'));

drop policy if exists "Supervisors and admins can update wind farms" on public.wind_farm;
create policy "Supervisors and admins can update wind farms"
  on public.wind_farm for update
  to authenticated
  using      ((select public.get_user_role()) in ('supervisor', 'admin'))
  with check ((select public.get_user_role()) in ('supervisor', 'admin'));

drop policy if exists "Supervisors and admins can delete wind farms" on public.wind_farm;
create policy "Supervisors and admins can delete wind farms"
  on public.wind_farm for delete
  to authenticated
  using ((select public.get_user_role()) in ('supervisor', 'admin'));

-- =========================================================
-- TURBINE
-- =========================================================
drop policy if exists "Supervisors and admins can insert turbines" on public.turbine;
create policy "Supervisors and admins can insert turbines"
  on public.turbine for insert
  to authenticated
  with check ((select public.get_user_role()) in ('supervisor', 'admin'));

drop policy if exists "Supervisors and admins can update turbines" on public.turbine;
create policy "Supervisors and admins can update turbines"
  on public.turbine for update
  to authenticated
  using      ((select public.get_user_role()) in ('supervisor', 'admin'))
  with check ((select public.get_user_role()) in ('supervisor', 'admin'));

drop policy if exists "Supervisors and admins can delete turbines" on public.turbine;
create policy "Supervisors and admins can delete turbines"
  on public.turbine for delete
  to authenticated
  using ((select public.get_user_role()) in ('supervisor', 'admin'));

-- =========================================================
-- INSPECTION
-- =========================================================
drop policy if exists "Inspectors can create inspections" on public.inspection;
create policy "Inspectors can create inspections"
  on public.inspection for insert
  to authenticated
  with check ((select public.get_user_role()) in ('inspector', 'supervisor', 'admin'));

drop policy if exists "Inspectors can update their own in-progress inspections" on public.inspection;
create policy "Inspectors can update their own in-progress inspections"
  on public.inspection for update
  to authenticated
  using (
    (inspector_id = (select auth.uid()) and status = 'in_progress')
    or (select public.get_user_role()) in ('supervisor', 'admin')
  )
  with check (
    (inspector_id = (select auth.uid()) and status = 'in_progress')
    or (select public.get_user_role()) in ('supervisor', 'admin')
  );

-- =========================================================
-- EVIDENCE
-- =========================================================
drop policy if exists "Inspectors can upload evidence to in-progress inspections" on public.evidence;
create policy "Inspectors can upload evidence to in-progress inspections"
  on public.evidence for insert
  to authenticated
  with check (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = (select auth.uid())
        and status = 'in_progress'
    )
  );

drop policy if exists "Inspectors can delete evidence from their in-progress inspections" on public.evidence;
create policy "Inspectors can delete evidence from their in-progress inspections"
  on public.evidence for delete
  to authenticated
  using (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = (select auth.uid())
        and status = 'in_progress'
    )
  );

-- =========================================================
-- DEFECT
-- =========================================================
drop policy if exists "Inspectors can create defects in their in-progress inspections" on public.defect;
create policy "Inspectors can create defects in their in-progress inspections"
  on public.defect for insert
  to authenticated
  with check (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = (select auth.uid())
        and status = 'in_progress'
    )
  );

drop policy if exists "Inspectors can update defects in their in-progress inspections" on public.defect;
create policy "Inspectors can update defects in their in-progress inspections"
  on public.defect for update
  to authenticated
  using (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = (select auth.uid())
        and status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = (select auth.uid())
        and status = 'in_progress'
    )
  );

drop policy if exists "Inspectors can delete defects in their in-progress inspections" on public.defect;
create policy "Inspectors can delete defects in their in-progress inspections"
  on public.defect for delete
  to authenticated
  using (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = (select auth.uid())
        and status = 'in_progress'
    )
  );

-- =========================================================
-- DEFECT_IMAGE
-- =========================================================
drop policy if exists "Inspectors can link images to defects in in-progress inspections" on public.defect_image;
create policy "Inspectors can link images to defects in in-progress inspections"
  on public.defect_image for insert
  to authenticated
  with check (
    exists (
      select 1 from public.defect d
      join public.inspection i on i.id = d.inspection_id
      where d.id = defect_id
        and i.inspector_id = (select auth.uid())
        and i.status = 'in_progress'
    )
  );

drop policy if exists "Inspectors can unlink images from defects in in-progress inspections" on public.defect_image;
create policy "Inspectors can unlink images from defects in in-progress inspections"
  on public.defect_image for delete
  to authenticated
  using (
    exists (
      select 1 from public.defect d
      join public.inspection i on i.id = d.inspection_id
      where d.id = defect_id
        and i.inspector_id = (select auth.uid())
        and i.status = 'in_progress'
    )
  );

-- =========================================================
-- REPORT
-- =========================================================
drop policy if exists "Authenticated users can create reports" on public.report;
create policy "Authenticated users can create reports"
  on public.report for insert
  to authenticated
  with check (generated_by = (select auth.uid()));
