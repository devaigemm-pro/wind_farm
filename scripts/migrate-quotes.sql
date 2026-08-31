-- Migration: Quotes & Work Orders module
-- Adds 'client' role and creates quote, quote_item, work_order tables.

-- ─── 1. Add 'client' role to profiles CHECK constraint ───────────────────────
-- Drop the existing role check constraint (name discovered dynamically) and
-- recreate it including 'client'.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('inspector', 'supervisor', 'admin', 'client'));
END $$;

-- ─── 2. quote ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turbine_id UUID REFERENCES turbine(id) ON DELETE SET NULL,
  wind_farm_id UUID REFERENCES wind_farm(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'quoted', 'approved', 'rejected')),
  currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
  quoted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  quoted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_turbine ON quote(turbine_id);
CREATE INDEX IF NOT EXISTS idx_quote_wind_farm ON quote(wind_farm_id);
CREATE INDEX IF NOT EXISTS idx_quote_status ON quote(status);
CREATE INDEX IF NOT EXISTS idx_quote_requested_by ON quote(requested_by);

-- ─── 3. quote_item ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
  defect_id UUID REFERENCES defect(id) ON DELETE SET NULL,
  labor_hours NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  labor_subtotal NUMERIC NOT NULL DEFAULT 0,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  materials_subtotal NUMERIC NOT NULL DEFAULT 0,
  item_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_item_quote ON quote_item(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_item_defect ON quote_item(defect_id);

-- ─── 4. work_order ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quote(id) ON DELETE SET NULL,
  quote_item_id UUID REFERENCES quote_item(id) ON DELETE SET NULL,
  defect_id UUID REFERENCES defect(id) ON DELETE SET NULL,
  turbine_id UUID REFERENCES turbine(id) ON DELETE SET NULL,
  wind_farm_id UUID REFERENCES wind_farm(id) ON DELETE SET NULL,
  blade_side TEXT,
  cost_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_order_turbine ON work_order(turbine_id);
CREATE INDEX IF NOT EXISTS idx_work_order_wind_farm ON work_order(wind_farm_id);
CREATE INDEX IF NOT EXISTS idx_work_order_defect ON work_order(defect_id);
CREATE INDEX IF NOT EXISTS idx_work_order_quote ON work_order(quote_id);
CREATE INDEX IF NOT EXISTS idx_work_order_status ON work_order(status);

-- ─── 5. RLS (permissive for authenticated; UI controls role-level access) ────
ALTER TABLE quote ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_select" ON quote FOR SELECT TO authenticated USING (true);
CREATE POLICY "quote_insert" ON quote FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quote_update" ON quote FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quote_delete" ON quote FOR DELETE TO authenticated USING (true);

CREATE POLICY "quote_item_select" ON quote_item FOR SELECT TO authenticated USING (true);
CREATE POLICY "quote_item_insert" ON quote_item FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quote_item_update" ON quote_item FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quote_item_delete" ON quote_item FOR DELETE TO authenticated USING (true);

CREATE POLICY "work_order_select" ON work_order FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_order_insert" ON work_order FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "work_order_update" ON work_order FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "work_order_delete" ON work_order FOR DELETE TO authenticated USING (true);
