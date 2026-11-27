-- Comment and recommendation written by the web user on a campaign (today: the
-- hoist certification of one turbine). Printed in that turbine's report.
-- Additive and nullable: existing rows and the mobile app are unaffected.
alter table public.campaign add column if not exists report_comment text;
alter table public.campaign add column if not exists report_recommendation text;
