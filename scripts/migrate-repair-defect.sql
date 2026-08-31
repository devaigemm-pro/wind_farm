-- Migration: add defect_id to repair photos so the 11-stage repair cycle
-- can be organized PER DEFECT instead of per campaign.
-- A repair photo belongs to: campaign_id (repair campaign) + defect_id + repair_stage.
ALTER TABLE inspection_photo ADD COLUMN IF NOT EXISTS defect_id uuid REFERENCES defect(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inspection_photo_repair_defect ON inspection_photo(campaign_id, defect_id, repair_stage);
