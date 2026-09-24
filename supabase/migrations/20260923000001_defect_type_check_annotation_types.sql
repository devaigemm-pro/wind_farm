-- Widen defect_type_check to accept both the legacy 7-value enum
-- (le_erosion, vortex, paint_defect, crack, delamination, lightning_damage,
-- other) AND every active annotation_type.name (~20 rich types such as
-- "CRACK", "LE EROSION", "SHELL DELAMINATION", "TE EROSION", "VOIDS", ...).
--
-- Rationale: defect.type stores the annotation_type name (used by the inline
-- edit select, the Excel importer and the annotations). The old check only
-- allowed 7 lowercase enum values, so editing/importing a richer type failed
-- with "new row for relation defect violates check constraint
-- defect_type_check". The list is rebuilt dynamically from annotation_type so
-- existing lowercase values keep working and all active types are accepted.
DO $$
DECLARE
  vals text;
BEGIN
  SELECT string_agg(quote_literal(v), ', ') INTO vals
  FROM (
    SELECT unnest(ARRAY[
      'le_erosion','vortex','paint_defect','crack',
      'delamination','lightning_damage','other'
    ]) AS v
    UNION
    SELECT name FROM annotation_type WHERE is_active
  ) t;

  EXECUTE 'ALTER TABLE defect DROP CONSTRAINT IF EXISTS defect_type_check';
  EXECUTE format(
    'ALTER TABLE defect ADD CONSTRAINT defect_type_check CHECK (type::text = ANY (ARRAY[%s]::text[]))',
    vals
  );
END $$;
