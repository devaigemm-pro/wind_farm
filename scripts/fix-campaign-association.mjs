import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const CAMPAIGN_ID = '1118f958-4b94-452c-a215-63c37fd70a44';
  const FDM_T02_ID = '10000000-0002-4000-8000-000000000002';

  // Get all blades for FDM-T02
  const { data: blades } = await supabase.from('blade').select('id, position').eq('turbine_id', FDM_T02_ID);
  console.log('FDM-T02 blades:', blades?.length);

  // Get all inspections with annotations for those blades
  for (const blade of (blades || [])) {
    const { data: inspections } = await supabase.from('inspection').select('id, campaign_id, stage').eq('blade_id', blade.id);
    for (const insp of (inspections || [])) {
      const { count } = await supabase.from('annotation').select('id', { count: 'exact', head: true }).eq('inspection_id', insp.id);
      if (count > 0) {
        console.log(`  Blade ${blade.position}: inspection ${insp.id} | campaign: ${insp.campaign_id} | stage: ${insp.stage} | annotations: ${count}`);
        // Associate to campaign if not already
        if (!insp.campaign_id) {
          const { error } = await supabase.from('inspection').update({ campaign_id: CAMPAIGN_ID }).eq('id', insp.id);
          console.log(`    → Associated to campaign: ${error ? 'ERROR: ' + error.message : 'OK'}`);
        }
      }
    }
  }

  // Verify
  const { data: campInsp } = await supabase.from('inspection').select('id, blade_id, stage').eq('campaign_id', CAMPAIGN_ID);
  console.log(`\nInspections now in campaign: ${campInsp?.length}`);
  campInsp?.forEach(i => console.log(`  ${i.id} blade:${i.blade_id} stage:${i.stage}`));

  process.exit(0);
}
main();
