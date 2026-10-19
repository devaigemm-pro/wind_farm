-- "Color" (Coating Method) of the blade, captured manually per repair from the
-- web Repair Workflow and shown in the repair report's "Datos del Aspa" table.
-- Replaces the unreliable in-browser OCR approach (Tesseract.js) with an
-- explicit, editable text field read straight from the DB.
ALTER TABLE repair
  ADD COLUMN IF NOT EXISTS blade_color text;
