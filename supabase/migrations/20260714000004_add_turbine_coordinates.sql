-- Migration: Add latitude/longitude to turbine for map markers
ALTER TABLE turbine
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;
