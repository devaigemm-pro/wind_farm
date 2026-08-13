import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const FDM_T02_ID = '10000000-0002-4000-8000-000000000002';

async function main() {
  console.log('Using service role (bypasses RLS)');

  // Delete all blades NOT belonging to FDM-T02
  const { data: deletedBlades, error: bladeErr } = await supabase
    .from('blade')
    .delete()
    .neq('turbine_id', FDM_T02_ID)
    .select('id');
  if (bladeErr) { console.error('Blade delete error:', bladeErr.message); process.exit(1); }
  console.log('Blades deleted:', deletedBlades?.length ?? 0);

  // Delete all turbines except FDM-T02
  const { data: deletedTurbines, error: turbErr } = await supabase
    .from('turbine')
    .delete()
    .neq('id', FDM_T02_ID)
    .select('id, name');
  if (turbErr) { console.error('Turbine delete error:', turbErr.message); process.exit(1); }
  console.log('Turbines deleted:', deletedTurbines?.length ?? 0);

  // Verify
  const { data: remaining } = await supabase.from('turbine').select('id, name');
  console.log('\nRemaining turbines:', remaining?.length);
  remaining?.forEach(t => console.log('  -', t.name));

  const { data: remainingBlades } = await supabase.from('blade').select('id, turbine_id');
  console.log('Remaining blades:', remainingBlades?.length);

  process.exit(0);
}
main();
