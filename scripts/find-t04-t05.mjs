import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');
await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });

for (const name of ['FDM-T04', 'FDM-T05']) {
  const { data: turbine } = await supabase.from('turbine').select('id, name').eq('name', name).single();
  if (!turbine) { console.log(name, '→ NOT FOUND'); continue; }
  
  const { data: inspections } = await supabase.from('inspection').select('id, stage, status, campaign_id').eq('turbine_id', turbine.id);
  const { data: blades } = await supabase.from('blade').select('id, position').eq('turbine_id', turbine.id).order('position');
  
  console.log(`\n${name} (${turbine.id})`);
  console.log('  Inspections:', JSON.stringify(inspections));
  console.log('  Blades:', JSON.stringify(blades));
}
