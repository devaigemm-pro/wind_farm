-- Add vertical_blade column to inspection table
-- Stores the user's selected vertical blade (A, B, or C) per inspection
-- Defaults to 'A' which is the standard initial position

ALTER TABLE inspection
ADD COLUMN IF NOT EXISTS vertical_blade text DEFAULT 'A';

-- Add a check constraint to ensure valid values
ALTER TABLE inspection
ADD CONSTRAINT inspection_vertical_blade_check 
CHECK (vertical_blade IN ('A', 'B', 'C'));
