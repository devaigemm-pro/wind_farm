-- Migration: allow any authenticated user to create a REPAIR campaign when a
-- quote is approved.
--
-- Problem: approving a quote calls createRepairCampaign() which inserts a row
-- into `campaign` with type='repair'. The only INSERT policy on `campaign`
-- ("Supervisors and admins can manage campaigns") restricts writes to
-- supervisor/admin roles. When a CLIENT approves a quote, the insert is blocked
-- by RLS (error 42501) and — because createRepairCampaign swallows errors — the
-- quote ends up 'approved' WITHOUT its repair campaign, silently.
--
-- Work orders are created fine because work_order_insert is
-- `TO authenticated WITH CHECK (true)`. We mirror that for repair campaigns,
-- but scope the new policy to type='repair' + a non-null quote_id so inspection
-- campaigns keep their supervisor/admin-only rule.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'campaign'
      AND policyname = 'Authenticated users can create repair campaigns'
  ) THEN
    CREATE POLICY "Authenticated users can create repair campaigns"
      ON campaign FOR INSERT TO authenticated
      WITH CHECK (type = 'repair' AND quote_id IS NOT NULL);
  END IF;
END $$;
