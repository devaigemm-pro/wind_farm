import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  // Delete the duplicate (the newer one)
  const DUPLICATE_ID = '11c42d78-7fc7-4ce8-9787-49085423d88d';
  const { error } = await supabase.from('defect').delete().eq('id', DUPLICATE_ID);
  console.log(error ? `ERROR: ${error.message}` : '✓ Duplicate defect deleted');

  // Verify
  const { count } = await supabase.from('defect').select('id', { count: 'exact', head: true }).eq('inspection_id', 'abe05885-3c6c-45f1-8550-5006b16118e2');
  console.log(`Defects remaining: ${count}`);

  process.exit(0);
}
main();
