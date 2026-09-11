-- Migration: add fields needed to populate the repair report PDF.
--   wind_farm.country   → "País"
--   wind_farm.client    → "Cliente"
--   turbine.manufacturer→ "Fabricante"
-- All nullable; loaded via the wind farm / turbine edit forms.

alter table public.wind_farm add column if not exists country varchar;
alter table public.wind_farm add column if not exists client  varchar;
alter table public.turbine   add column if not exists manufacturer varchar;
