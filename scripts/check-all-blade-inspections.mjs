import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const FDM_T02_ID = '10000000-0002-4000-8000-000000000002';

  // Get all blades for FDM-T02
  const { data: blades } = await supabase.from('blade').select('id, position').eq('turbine_id', FDM_T02_ID);
  console.log('FDM-T02 blades:', blades?.length);
  
  for (const blade of (blades || [])) {
    console.log(`\n  Blade position ${blade.position} (${blade.id}):`);
    const { data: inspections } = await supabase.from('inspection').select('id, campaign_id, stage').eq('blade_id', blade.id);
    console.log(`    Inspections: ${inspections?.length}`);
    for (const insp of (inspections || [])) {
      const { count } = await supabase.from('annotation').select('id', { count: 'exact', head: true }).eq('inspection_id', insp.id);
      console.log(`      ${insp.id} | campaign: ${insp.campaign_id} | stage: ${insp.stage} | annotations: ${count}`);
    }
  }

  process.exit(0);
}
main();
