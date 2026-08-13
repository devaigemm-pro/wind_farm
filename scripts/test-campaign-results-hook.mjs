/**
 * Simulates exactly what useCampaignResults does for the campaign.
 */
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const campaignId = '1118f958-4b94-452c-a215-63c37fd70a44';

  // Step 1: campaign with wind_farm
  const { data: campaignRow, error: campErr } = await supabase
    .from('campaign')
    .select('id, name, created_at, wind_farm:wind_farm_id(id, name)')
    .eq('id', campaignId)
    .single();
  console.log('Campaign query error:', campErr?.message ?? 'none');
  console.log('Campaign:', JSON.stringify(campaignRow, null, 2));

  // Step 2: inspections with blade/turbine
  const { data: inspections, error: inspErr } = await supabase
    .from('inspection')
    .select(`
      id,
      blade:blade!inspection_blade_id_fkey(
        position,
        turbine:turbine!blade_turbine_id_fkey(id, name)
      )
    `)
    .eq('campaign_id', campaignId);
  console.log('\nInspections query error:', inspErr?.message ?? 'none');
  console.log('Inspections:', JSON.stringify(inspections, null, 2));

  if (!inspections || inspections.length === 0) {
    console.log('NO INSPECTIONS — page would show empty state');
    process.exit(0);
  }

  // Step 3: annotations
  const inspectionIds = inspections.map(i => i.id);
  const { data: annotations, error: annErr } = await supabase
    .from('annotation')
    .select('id, inspection_id, type, category, note, side, x, y, w, h')
    .in('inspection_id', inspectionIds);
  console.log('\nAnnotations query error:', annErr?.message ?? 'none');
  console.log('Annotations:', JSON.stringify(annotations, null, 2));

  // Build results like the hook does
  const BLADE_LABELS = { 1: 'A', 2: 'B', 3: 'C' };
  const inspLookup = new Map();
  for (const insp of inspections) {
    const blade = insp.blade;
    const turbine = blade?.turbine;
    if (!turbine) continue;
    inspLookup.set(insp.id, {
      bladePosition: blade.position,
      turbineId: turbine.id,
      turbineName: turbine.name,
    });
  }

  console.log('\nInspection lookup:', JSON.stringify(Object.fromEntries(inspLookup)));

  let defectCount = 0;
  for (const ann of (annotations || [])) {
    const lookup = inspLookup.get(ann.inspection_id);
    if (lookup) {
      defectCount++;
      console.log(`  Defect: ${ann.type} | cat:${ann.category} | turbine:${lookup.turbineName} | blade:${BLADE_LABELS[lookup.bladePosition]}`);
    } else {
      console.log(`  WARNING: annotation ${ann.id} has no inspection lookup`);
    }
  }
  console.log(`\nTotal defects that would show: ${defectCount}`);

  process.exit(0);
}
main();
