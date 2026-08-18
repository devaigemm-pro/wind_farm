-- Migration: Add root_distance column to annotation table
-- This stores the calculated distance from blade root (in meters) when an annotation is created

ALTER TABLE public.annotation 
  ADD COLUMN IF NOT EXISTS root_distance NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.annotation.root_distance IS 'Distance from blade root in meters, calculated from photo metadata + annotation Y position';
