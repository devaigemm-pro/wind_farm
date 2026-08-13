import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const CAMPAIGN_ID = '1118f958-4b94-452c-a215-63c37fd70a44';

  // Replicate the exact query from useCampaignResults
  const { data: inspections, error: inspErr } = await supabase
    .from('inspection')
    .select(`
      id,
      blade:blade!inspection_blade_id_fkey(
        position,
        turbine:turbine!blade_turbine_id_fkey(id, name)
      )
    `)
    .eq('campaign_id', CAMPAIGN_ID);

  console.log('Query error:', inspErr?.message ?? 'none');
  console.log('Inspections:', JSON.stringify(inspections, null, 2));

  // Also check the blade directly
  const { data: blade } = await supabase.from('blade').select('id, position, turbine_id').eq('id', 'b0000000-0004-4000-8000-000000000004').single();
  console.log('\nBlade:', JSON.stringify(blade, null, 2));

  // Check if FDM-T02 turbine still exists
  const { data: turbine } = await supabase.from('turbine').select('id, name').eq('id', '10000000-0002-4000-8000-000000000002').single();
  console.log('Turbine:', JSON.stringify(turbine, null, 2));

  process.exit(0);
}
main();
