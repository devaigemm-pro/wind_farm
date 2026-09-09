-- Migration: derive repair campaign status + defect.resolved from repair.status
-- ('completed'), robust against the drone app's offline sync model.
--
-- Source of truth: repair.status = 'completed' (the drone app queues this and
-- uploads it only after all photos are synced). We DO NOT rely on the app
-- writing campaign.status or defect.resolved; a DB trigger recomputes them
-- whenever a repair row changes.
--
-- Relations:
--   campaign.quote_id  -> quote.id
--   work_order.quote_id -> quote.id      (one work_order per defect)
--   work_order.defect_id -> defect.id
--   repair.work_order_id -> work_order.id (one repair per work order)
--
-- Rules:
--   defect reparado    = its repair.status = 'completed'
--   campaign finalizada = ALL work orders of the quote have a completed repair
--
-- Everything here is idempotent (safe if the app also writes the same values).

-- ─── 1. Recompute function for a single quote ────────────────────────────────
CREATE OR REPLACE FUNCTION recompute_repair_campaign_status(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total int;
  v_done  int;
  v_status text;
BEGIN
  IF p_quote_id IS NULL THEN
    RETURN;
  END IF;

  -- Count work orders of the quote vs those with a completed repair.
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE r.status = 'completed')
    INTO v_total, v_done
  FROM work_order wo
  LEFT JOIN repair r ON r.work_order_id = wo.id
  WHERE wo.quote_id = p_quote_id;

  v_status := CASE
    WHEN v_total > 0 AND v_done = v_total THEN 'repair_done'
    WHEN v_done > 0 THEN 'repair_in_progress'
    ELSE 'repair_open'
  END;

  -- Update the repair campaign(s) for this quote (idempotent).
  UPDATE campaign
     SET status = v_status,
         updated_at = now()
   WHERE quote_id = p_quote_id
     AND type = 'repair'
     AND status IS DISTINCT FROM v_status;

  -- Keep defect.resolved consistent for defects whose repair is completed.
  UPDATE defect d
     SET resolved = true
   FROM work_order wo
   JOIN repair r ON r.work_order_id = wo.id
   WHERE wo.defect_id = d.id
     AND wo.quote_id = p_quote_id
     AND r.status = 'completed'
     AND d.resolved IS DISTINCT FROM true;

  -- And un-resolve defects whose repair is no longer completed (idempotent both ways).
  UPDATE defect d
     SET resolved = false
   FROM work_order wo
   LEFT JOIN repair r ON r.work_order_id = wo.id
   WHERE wo.defect_id = d.id
     AND wo.quote_id = p_quote_id
     AND (r.status IS DISTINCT FROM 'completed')
     AND d.resolved IS DISTINCT FROM false;
END;
$$;

-- ─── 2. Trigger function on repair ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_repair_recompute_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote_id uuid;
BEGIN
  -- Resolve the affected quote via the work order.
  SELECT wo.quote_id INTO v_quote_id
  FROM work_order wo
  WHERE wo.id = COALESCE(NEW.work_order_id, OLD.work_order_id);

  PERFORM recompute_repair_campaign_status(v_quote_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── 3. Attach trigger (recreate to stay idempotent) ─────────────────────────
DROP TRIGGER IF EXISTS repair_recompute_campaign ON repair;
CREATE TRIGGER repair_recompute_campaign
  AFTER INSERT OR UPDATE OF status OR DELETE ON repair
  FOR EACH ROW
  EXECUTE FUNCTION trg_repair_recompute_campaign();

-- ─── 4. Backfill: recompute status for every existing repair campaign ────────
DO $$
DECLARE
  q record;
BEGIN
  FOR q IN SELECT DISTINCT quote_id FROM campaign WHERE type = 'repair' AND quote_id IS NOT NULL
  LOOP
    PERFORM recompute_repair_campaign_status(q.quote_id);
  END LOOP;
END $$;
