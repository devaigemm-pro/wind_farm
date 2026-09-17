-- Allow 'repair' as a valid report type.
--
-- ROOT CAUSE: the report table had a CHECK constraint report_type_check that only
-- permitted type in ('inspection', 'consolidated'). The repair report flow inserts
-- rows with type='repair', so the insert failed with error 23514 (check constraint
-- violation). Because the insert is wrapped in a silent try/catch, the report row was
-- never persisted, and the "Download report" button in RepairWorkflow disappeared on
-- reload. Widening the constraint to include 'repair' lets those rows persist so the
-- button survives across sessions and users.
alter table public.report drop constraint if exists report_type_check;
alter table public.report
  add constraint report_type_check
  check (type in ('inspection', 'consolidated', 'repair'));

-- SELECT and INSERT policies on public.report already grant access to all
-- authenticated users without discriminating by type (see 20240101000003), so no
-- new policies are needed there. The only missing piece is a DELETE policy: the
-- repair report flow deletes the previous report row before re-inserting a fresh one
-- (cleanup on regenerate). Without a DELETE policy that cleanup fails silently under
-- RLS, leaving stale storage paths behind. Add the minimal missing DELETE policy.
drop policy if exists "report_delete" on public.report;
create policy "report_delete"
  on public.report for delete
  to authenticated
  using (true);
