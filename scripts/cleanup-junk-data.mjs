/**
 * Cleanup junk/seeded data from the database.
 * Keeps only the real Skyvisor imported inspection data.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Authenticate
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'Password123!',
  });
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
  console.log('✓ Authenticated');

  // 1. Delete all defect_image records
  const r1 = await supabase.from('defect_image').delete().neq('defect_id', '00000000-0000-0000-0000-000000000000');
  console.log('1. defect_image:', r1.error ? `ERROR: ${r1.error.message}` : `deleted ${r1.data?.length ?? 0} rows`);

  // 2. Delete all evidence records
  const r2 = await supabase.from('evidence').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('2. evidence:', r2.error ? `ERROR: ${r2.error.message}` : `deleted ${r2.data?.length ?? 0} rows`);

  // 3. Delete all defect records (real defects are in annotation table)
  const r3 = await supabase.from('defect').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('3. defect:', r3.error ? `ERROR: ${r3.error.message}` : `deleted ${r3.data?.length ?? 0} rows`);

  // 4. Delete auto-generated campaigns
  const r4 = await supabase.from('campaign').delete().eq('name', 'Auto-generated campaign');
  console.log('4. Auto-generated campaigns:', r4.error ? `ERROR: ${r4.error.message}` : `deleted ${r4.data?.length ?? 0} rows`);

  // 5. Delete "Campaign 20000000" campaigns
  const r5 = await supabase.from('campaign').delete().eq('name', 'Campaign 20000000');
  console.log('5. Campaign 20000000:', r5.error ? `ERROR: ${r5.error.message}` : `deleted ${r5.data?.length ?? 0} rows`);

  // 6. Delete "Seed Campaign" campaigns
  const r6 = await supabase.from('campaign').delete().like('name', 'Seed Campaign%');
  console.log('6. Seed campaigns:', r6.error ? `ERROR: ${r6.error.message}` : `deleted ${r6.data?.length ?? 0} rows`);

  console.log('\n✓ Cleanup complete');
  process.exit(0);
}

main();
