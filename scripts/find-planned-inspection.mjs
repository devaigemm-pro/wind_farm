import { createClient } from '@supabase/supabase-js';

const url = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const key = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';
const supabase = createClient(url, key);

// Auth
const { error: authError } = await supabase.auth.signInWithPassword({
  email: 'admin@windfarm.dev',
  password: 'Password123!',
});
if (authError) { console.error('Auth failed:', authError.message); process.exit(1); }

// Find turbine FDM-T03
const { data: turbines } = await supabase
  .from('turbine')
  .select('id, name, wind_farm_id')
  .ilike('name', '%FDM-T03%');

console.log('Turbines matching FDM-T03:', JSON.stringify(turbines, null, 2));

if (!turbines || turbines.length === 0) {
  const { data: allT } = await supabase.from('turbine').select('id, name').limit(30);
  console.log('All turbines (first 30):', JSON.stringify(allT?.map(t => t.name), null, 2));
  process.exit(0);
}

const turbineId = turbines[0].id;

// Get ALL inspections for this turbine
const { data: inspections } = await supabase
  .from('inspection')
  .select('id, stage, status, campaign_id')
  .eq('turbine_id', turbineId);

console.log('All inspections for FDM-T03:', JSON.stringify(inspections, null, 2));

const planned = inspections?.filter(i => i.stage === 'planned');
console.log('Planned:', JSON.stringify(planned, null, 2));

// Also show blades
const { data: blades } = await supabase
  .from('blade')
  .select('id, position, serial_number')
  .eq('turbine_id', turbineId)
  .order('position');
console.log('Blades:', JSON.stringify(blades, null, 2));
