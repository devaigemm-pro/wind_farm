import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const campaignId = '1118f958-4b94-452c-a215-63c37fd70a44';

  // Replicate the new logic
  // 1. Get campaign inspections to find turbines
  const { data: campInsp } = await supabase
    .from('inspection')
    .select('id, blade:blade!inspection_blade_id_fkey(id, position, turbine:turbine!blade_turbine_id_fkey(id, name))')
    .eq('campaign_id', campaignId);
  
  const turbineIds = new Set();
  for (const insp of (campInsp || [])) {
    if (insp.blade?.turbine?.id) turbineIds.add(insp.blade.turbine.id);
  }
  console.log('Turbines found:', [...turbineIds]);

  // 2. Get ALL blades for those turbines
  const { data: allBlades } = await supabase
    .from('blade')
    .select('id, position, turbine:turbine_id(id, name)')
    .in('turbine_id', [...turbineIds]);
  console.log('All blades:', allBlades?.length);
  allBlades?.forEach(b => console.log(`  pos ${b.position}: ${b.id}`));

  // 3. Get ALL inspections for those blades
  const bladeIds = (allBlades || []).map(b => b.id);
  const { data: allInsp } = await supabase
    .from('inspection')
    .select('id, blade:blade!inspection_blade_id_fkey(id, position, turbine:turbine!blade_turbine_id_fkey(id, name))')
    .in('blade_id', bladeIds);
  console.log('Total inspections across all blades:', allInsp?.length);

  // 4. Get annotations for all those inspections
  const inspIds = (allInsp || []).map(i => i.id);
  const { data: annotations, count } = await supabase
    .from('annotation')
    .select('id, inspection_id, type, category', { count: 'exact' })
    .in('inspection_id', inspIds);
  console.log('Total annotations (defects):', count);
  
  // Group by blade
  const inspLookup = new Map();
  for (const insp of (allInsp || [])) {
    if (insp.blade?.turbine) {
      inspLookup.set(insp.id, { pos: insp.blade.position, turbine: insp.blade.turbine.name });
    }
  }
  
  const byBlade = { 1: 0, 2: 0, 3: 0 };
  for (const ann of (annotations || [])) {
    const lookup = inspLookup.get(ann.inspection_id);
    if (lookup) byBlade[lookup.pos] = (byBlade[lookup.pos] || 0) + 1;
  }
  console.log('By blade:', byBlade);

  process.exit(0);
}
main();
