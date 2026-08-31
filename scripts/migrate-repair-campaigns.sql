-- Migration: Repair campaigns (Option A - reuse campaign table with a type discriminator)
-- Adds `type`, `turbine_id` and `quote_id` to the campaign table so the same
-- table can hold both inspection campaigns and repair campaigns generated when a
-- quote is approved.

-- 1) Discriminator: inspection (default, keeps existing rows) vs repair
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'inspection';

-- 2) Associate a repair campaign with a specific turbine (inspection ones stay null)
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS turbine_id uuid REFERENCES turbine(id) ON DELETE SET NULL;

-- 3) Traceability link to the quote that originated the repair campaign
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quote(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_type ON campaign(type);
CREATE INDEX IF NOT EXISTS idx_campaign_turbine ON campaign(turbine_id);
CREATE INDEX IF NOT EXISTS idx_campaign_quote ON campaign(quote_id);

-- 4) CHECK constraint for type
ALTER TABLE campaign DROP CONSTRAINT IF EXISTS campaign_type_check;
ALTER TABLE campaign ADD CONSTRAINT campaign_type_check CHECK (type IN ('inspection', 'repair'));

-- 5) Widen the status CHECK (if it exists) to include repair states.
-- The status column was created as free text (DEFAULT 'awaiting_photos') so a
-- CHECK may or may not exist. This block finds the current status check
-- constraint by name, drops it and recreates it including both inspection and
-- repair states. If no status CHECK exists, only the new one is added.
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'campaign'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE campaign DROP CONSTRAINT %I', con.conname);
  END LOOP;

  ALTER TABLE campaign ADD CONSTRAINT campaign_status_check CHECK (
    status IN (
      'awaiting_photos', 'photos_uploaded', 'annotating', 'completed',
      'repair_open', 'repair_in_progress', 'repair_done'
    )
  );
END $$;
