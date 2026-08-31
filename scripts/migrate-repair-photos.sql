-- Migration: Repair photos flow
-- Reuses inspection_photo for repair-stage photos (campaign.type='repair').
-- repair_stage: which repair stage the photo belongs to (null for inspection photos).
-- repair_selected: whether the photo is chosen to appear in the repair PDF report.

ALTER TABLE inspection_photo ADD COLUMN IF NOT EXISTS repair_stage TEXT;
ALTER TABLE inspection_photo ADD COLUMN IF NOT EXISTS repair_selected BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_inspection_photo_repair_stage ON inspection_photo(campaign_id, repair_stage);
