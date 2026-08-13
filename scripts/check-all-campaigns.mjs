import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const { data: campaigns } = await supabase.from('campaign').select('id, name, wind_farm_id');
  console.log('All campaigns:', campaigns?.length);
  campaigns?.forEach(c => console.log('  -', c.id, c.name, 'farm:', c.wind_farm_id));

  // For each campaign, count inspections
  for (const c of (campaigns || [])) {
    const { count } = await supabase.from('inspection').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id);
    console.log(`    Inspections: ${count}`);
  }

  process.exit(0);
}
main();
