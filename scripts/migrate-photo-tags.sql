-- Migration: Add is_tagged column to inspection_photo table
-- Allows persisting photo tag state in the database instead of local React state.

ALTER TABLE inspection_photo ADD COLUMN IF NOT EXISTS is_tagged BOOLEAN DEFAULT FALSE;
