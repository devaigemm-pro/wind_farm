-- Allow anonymous (unauthenticated) users to read data for shared views
CREATE POLICY IF NOT EXISTS "Anon can read wind_farm" ON wind_farm FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "Anon can read turbine" ON turbine FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "Anon can read blade" ON blade FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "Anon can read inspection" ON inspection FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "Anon can read defect" ON defect FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "Anon can read annotation" ON annotation FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "Anon can read campaign" ON campaign FOR SELECT TO anon USING (true);
