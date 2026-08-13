-- Add is_defect column to annotation table to persist confirmed defect status
ALTER TABLE annotation ADD COLUMN IF NOT EXISTS is_defect boolean NOT NULL DEFAULT false;
