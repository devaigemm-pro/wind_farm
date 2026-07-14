-- Create storage buckets
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false);
insert into storage.buckets (id, name, public) values ('reports', 'reports', false);

-- Evidence bucket policies
create policy "Authenticated users can view evidence"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'evidence');

create policy "Inspectors can upload evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and public.get_user_role() in ('inspector', 'supervisor', 'admin')
  );

create policy "Inspectors can delete their own evidence"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reports bucket policies
create policy "Authenticated users can view reports"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'reports');

create policy "Authenticated users can upload reports"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'reports');
