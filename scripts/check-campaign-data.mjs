import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const CAMPAIGN_ID = '1118f958-4b94-452c-a215-63c37fd70a44';

  const { data: camp } = await supabase.from('campaign').select('*').eq('id', CAMPAIGN_ID).single();
  console.log('Campaign:', camp?.name, '| wind_farm:', camp?.wind_farm_id);

  const { data: inspections } = await supabase.from('inspection').select('id, blade_id, campaign_id, stage').eq('campaign_id', CAMPAIGN_ID);
  console.log('Inspections:', inspections?.length);
  if (inspections) {
    for (const i of inspections) {
      console.log('  -', i.id, 'blade:', i.blade_id, 'stage:', i.stage);
    }
    const ids = inspections.map(i => i.id);
    const { data: anns, count } = await supabase.from('annotation').select('id, inspection_id, type, category', { count: 'exact' }).in('inspection_id', ids);
    console.log('Annotations total:', count);
    if (anns) anns.slice(0, 10).forEach(a => console.log('  -', a.type, 'cat:', a.category, 'insp:', a.inspection_id));
  }

  process.exit(0);
}
main();
