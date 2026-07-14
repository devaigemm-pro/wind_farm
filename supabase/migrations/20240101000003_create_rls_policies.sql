-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.wind_farm enable row level security;
alter table public.turbine enable row level security;
alter table public.blade enable row level security;
alter table public.inspection enable row level security;
alter table public.evidence enable row level security;
alter table public.defect enable row level security;
alter table public.defect_image enable row level security;
alter table public.report enable row level security;

-- === PROFILES ===
create policy "Users can read all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- === WIND_FARM ===
create policy "All authenticated users can read wind farms"
  on public.wind_farm for select
  to authenticated
  using (true);

create policy "Supervisors and admins can insert wind farms"
  on public.wind_farm for insert
  to authenticated
  with check (public.get_user_role() in ('supervisor', 'admin'));

create policy "Supervisors and admins can update wind farms"
  on public.wind_farm for update
  to authenticated
  using (public.get_user_role() in ('supervisor', 'admin'));

create policy "Supervisors and admins can delete wind farms"
  on public.wind_farm for delete
  to authenticated
  using (public.get_user_role() in ('supervisor', 'admin'));

-- === TURBINE ===
create policy "All authenticated users can read turbines"
  on public.turbine for select
  to authenticated
  using (true);

create policy "Supervisors and admins can insert turbines"
  on public.turbine for insert
  to authenticated
  with check (public.get_user_role() in ('supervisor', 'admin'));

create policy "Supervisors and admins can update turbines"
  on public.turbine for update
  to authenticated
  using (public.get_user_role() in ('supervisor', 'admin'));

create policy "Supervisors and admins can delete turbines"
  on public.turbine for delete
  to authenticated
  using (public.get_user_role() in ('supervisor', 'admin'));

-- === BLADE ===
create policy "All authenticated users can read blades"
  on public.blade for select
  to authenticated
  using (true);

-- === INSPECTION ===
create policy "All authenticated users can read inspections"
  on public.inspection for select
  to authenticated
  using (true);

create policy "Inspectors can create inspections"
  on public.inspection for insert
  to authenticated
  with check (public.get_user_role() in ('inspector', 'supervisor', 'admin'));

create policy "Inspectors can update their own in-progress inspections"
  on public.inspection for update
  to authenticated
  using (
    (inspector_id = auth.uid() and status = 'in_progress')
    or public.get_user_role() in ('supervisor', 'admin')
  );

-- === EVIDENCE ===
create policy "All authenticated users can read evidence"
  on public.evidence for select
  to authenticated
  using (true);

create policy "Inspectors can upload evidence to in-progress inspections"
  on public.evidence for insert
  to authenticated
  with check (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = auth.uid()
        and status = 'in_progress'
    )
  );

create policy "Inspectors can delete evidence from their in-progress inspections"
  on public.evidence for delete
  to authenticated
  using (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = auth.uid()
        and status = 'in_progress'
    )
  );

-- === DEFECT ===
create policy "All authenticated users can read defects"
  on public.defect for select
  to authenticated
  using (true);

create policy "Inspectors can create defects in their in-progress inspections"
  on public.defect for insert
  to authenticated
  with check (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = auth.uid()
        and status = 'in_progress'
    )
  );

create policy "Inspectors can update defects in their in-progress inspections"
  on public.defect for update
  to authenticated
  using (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = auth.uid()
        and status = 'in_progress'
    )
  );

create policy "Inspectors can delete defects in their in-progress inspections"
  on public.defect for delete
  to authenticated
  using (
    exists (
      select 1 from public.inspection
      where id = inspection_id
        and inspector_id = auth.uid()
        and status = 'in_progress'
    )
  );

-- === DEFECT_IMAGE ===
create policy "All authenticated users can read defect images"
  on public.defect_image for select
  to authenticated
  using (true);

create policy "Inspectors can link images to defects in in-progress inspections"
  on public.defect_image for insert
  to authenticated
  with check (
    exists (
      select 1 from public.defect d
      join public.inspection i on i.id = d.inspection_id
      where d.id = defect_id
        and i.inspector_id = auth.uid()
        and i.status = 'in_progress'
    )
  );

create policy "Inspectors can unlink images from defects in in-progress inspections"
  on public.defect_image for delete
  to authenticated
  using (
    exists (
      select 1 from public.defect d
      join public.inspection i on i.id = d.inspection_id
      where d.id = defect_id
        and i.inspector_id = auth.uid()
        and i.status = 'in_progress'
    )
  );

-- === REPORT ===
create policy "All authenticated users can read reports"
  on public.report for select
  to authenticated
  using (true);

create policy "Authenticated users can create reports"
  on public.report for insert
  to authenticated
  with check (generated_by = auth.uid());
