-- Migration: Persist the per-blade defect correlative (A27, A28, B4, ...) on
-- the `defect` table so ANY app connected to this Supabase (the web analyst app
-- and the separate technician app) can read `defect.defect_number` directly,
-- without recomputing the campaign-wide numbering at runtime.
--
-- The number is a per-blade (A/B/C) correlative over ALL `annotation` rows of
-- the WHOLE CAMPAIGN the defect belongs to, ordered by annotation.created_at
-- ASC, incrementing a per-letter counter for EVERY annotation (defect or not).
-- Blade letter of an annotation is derived from its photo:
--   annotation.thumbnail_id -> inspection_photo.id -> inspection_photo.blade_id
--   -> blade.position (1=A, 2=B, 3=C).
-- The defect<->annotation link is: defect.description = annotation.id (36-char UUID).
-- The campaign of a defect: defect.inspection_id -> inspection.campaign_id.
--
-- This migration is idempotent and non-destructive: it only ADDs a nullable
-- column, (re)creates the recompute function, backfills the new column and
-- grants EXECUTE on the new function. It touches no other column nor RLS.

----------------------------------------------------------------------
-- 1. New nullable column on defect
----------------------------------------------------------------------
ALTER TABLE public.defect ADD COLUMN IF NOT EXISTS defect_number text;

----------------------------------------------------------------------
-- 2. Recompute function: reproduces EXACTLY the TS algorithm
--    (buildCampaignAnnotationCodeMap) for one campaign.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_campaign_defect_numbers(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN;
  END IF;

  -- No-op if the campaign does not exist.
  IF NOT EXISTS (SELECT 1 FROM public.campaign c WHERE c.id = p_campaign_id) THEN
    RETURN;
  END IF;

  WITH campaign_inspections AS (
    -- All inspections of the campaign.
    SELECT i.id AS inspection_id
    FROM public.inspection i
    WHERE i.campaign_id = p_campaign_id
  ),
  ann AS (
    -- All annotations of those inspections, with the derived blade letter.
    -- Annotations whose photo/blade cannot be resolved (letter IS NULL) are
    -- kept here so the ordering matches, but they are skipped from the counter
    -- below (mirrors the TS `if (!letter) continue`).
    SELECT
      a.id AS annotation_id,
      a.created_at,
      CASE b.position
        WHEN 1 THEN 'A'
        WHEN 2 THEN 'B'
        WHEN 3 THEN 'C'
        ELSE NULL
      END AS letter
    FROM public.annotation a
    JOIN campaign_inspections ci ON ci.inspection_id = a.inspection_id
    -- annotation.thumbnail_id is text while inspection_photo.id is uuid, so
    -- cast the uuid to text for the join (mirrors the TS lookup by id string).
    LEFT JOIN public.inspection_photo p ON p.id::text = a.thumbnail_id
    LEFT JOIN public.blade b ON b.id = p.blade_id
  ),
  numbered AS (
    -- Per-letter correlative ordered by created_at ASC. Only annotations with a
    -- resolved letter get a number (the counter increments once per such
    -- annotation, defect or not), identical to the TS per-blade counter.
    SELECT
      annotation_id,
      letter
        || row_number() OVER (
             PARTITION BY letter
             ORDER BY created_at ASC, annotation_id ASC
           )::text AS code
    FROM ann
    WHERE letter IS NOT NULL
  )
  UPDATE public.defect d
  SET defect_number = n.code
  FROM numbered n
  JOIN public.inspection di ON di.campaign_id = p_campaign_id
  WHERE d.inspection_id = di.id
    AND d.description = n.annotation_id::text;
END;
$$;

-- The function is called from the web app via supabase.rpc() by authenticated
-- users; anon must NOT be able to run it.
REVOKE ALL ON FUNCTION public.recompute_campaign_defect_numbers(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_campaign_defect_numbers(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recompute_campaign_defect_numbers(uuid) TO authenticated;

----------------------------------------------------------------------
-- 3. Backfill: recompute for every existing campaign.
--    Defects in inspections without a campaign_id stay defect_number = NULL,
--    which is fine (the app falls back to runtime numbering for those).
----------------------------------------------------------------------
DO $$
DECLARE
  c uuid;
BEGIN
  FOR c IN SELECT DISTINCT id FROM public.campaign LOOP
    PERFORM public.recompute_campaign_defect_numbers(c);
  END LOOP;
END $$;
