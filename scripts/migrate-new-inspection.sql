-- Migration: New Inspection form support (geolocation coordinates)
-- Part of RF-002: Módulo de Planificación y Registro de Nueva Inspección

-- 1. Add geolocation fields to wind_farm
ALTER TABLE wind_farm
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- 2. Seed default coordinates for Fila de Mogote (Costa Rica)
UPDATE wind_farm
SET latitude = 10.7089, longitude = -85.2528
WHERE name ILIKE '%mogote%' OR name ILIKE '%fila%';
