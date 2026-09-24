-- Migration: persistent history of defect-spreadsheet imports.
--
-- Today the repair-campaign Excel import (repair-import.service.ts) writes
-- defects into the business tables but keeps NO record of the upload itself:
-- the RepairImportSummary only lives in React state and is lost on reload.
--
-- This adds two tables:
--   * defect_import      — one row per import "batch" (who, when, file, totals).
--   * defect_import_row  — a snapshot of every spreadsheet row as it came in,
--                          plus its per-row result (ok/error + reason).
--
-- The Defects tab lists ALL users' imports (product decision), so the SELECT
-- policies use USING (true) and do NOT filter by auth.uid(), consistent with
-- the annotation_comment / campaign read policies in this project.
-- uploaded_by references profiles(id) like campaign.created_by
-- (see 20260910000004_user_delete_set_null.sql).

-- ─── Batch table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.defect_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name text,
  total int NOT NULL DEFAULT 0,
  ok_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Per-row snapshot table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.defect_import_row (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.defect_import(id) ON DELETE CASCADE,
  fila int,
  parque text,
  turbina text,
  ubicacion_danio text,
  defect_identifier text,
  serial_pala text,
  lado text,
  tipo text,
  status text NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_defect_import_created_at
  ON public.defect_import (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_defect_import_row_import_id
  ON public.defect_import_row (import_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.defect_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_import_row ENABLE ROW LEVEL SECURITY;

-- All authenticated users can READ every import (listing shows all users').
DROP POLICY IF EXISTS "Authenticated users can read defect imports" ON public.defect_import;
CREATE POLICY "Authenticated users can read defect imports"
  ON public.defect_import FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert defect imports" ON public.defect_import;
CREATE POLICY "Authenticated users can insert defect imports"
  ON public.defect_import FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read defect import rows" ON public.defect_import_row;
CREATE POLICY "Authenticated users can read defect import rows"
  ON public.defect_import_row FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert defect import rows" ON public.defect_import_row;
CREATE POLICY "Authenticated users can insert defect import rows"
  ON public.defect_import_row FOR INSERT TO authenticated WITH CHECK (true);
