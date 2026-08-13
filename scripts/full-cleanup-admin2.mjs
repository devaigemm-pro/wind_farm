/**
 * Full cleanup v2 — handles inspection.turbine_id FK too.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const FDM_T02_ID = '10000000-0002-4000-8000-000000000002';

async function main() {
  console.log('Using service role (bypasses RLS)\n');

  // Get all turbine IDs except FDM-T02
  const { data: turbines } = await supabase.from('turbine').select('id, name').neq('id', FDM_T02_ID);
  const turbineIds = (turbines || []).map(t => t.id);
  console.log(`Turbines to delete: ${turbineIds.length}`);

  // Get inspections that reference these turbines directly (via turbine_id column)
  if (turbineIds.length > 0) {
    const { data: turbineInspections } = await supabase
      .from('inspection')
      .select('id')
      .in('turbine_id', turbineIds);
    const turbInspIds = (turbineInspections || []).map(i => i.id);
    console.log(`Inspections referencing turbines directly: ${turbInspIds.length}`);

    if (turbInspIds.length > 0) {
      // Delete their annotations first
      const BATCH = 50;
      for (let i = 0; i < turbInspIds.length; i += BATCH) {
        const batch = turbInspIds.slice(i, i + BATCH);
        await supabase.from('annotation').delete().in('inspection_id', batch);
      }
      // Delete defects
      const { data: defects } = await supabase.from('defect').select('id').in('inspection_id', turbInspIds);
      const defectIds = (defects || []).map(d => d.id);
      if (defectIds.length > 0) {
        await supabase.from('defect_image').delete().in('defect_id', defectIds);
        await supabase.from('evidence').delete().in('defect_id', defectIds);
        await supabase.from('defect').delete().in('id', defectIds);
      }
      // Delete these inspections
      for (let i = 0; i < turbInspIds.length; i += BATCH) {
        const batch = turbInspIds.slice(i, i + BATCH);
        await supabase.from('inspection').delete().in('id', batch);
      }
      console.log('✓ turbine-linked inspections deleted');
    }
  }

  // Now delete turbines
  const { data: delTurb, error: tErr } = await supabase.from('turbine').delete().neq('id', FDM_T02_ID).select('id, name');
  if (tErr) { console.error('Turbine error:', tErr.message); process.exit(1); }
  console.log(`✓ ${delTurb?.length ?? 0} turbines deleted`);

  // Delete wind farms with no turbines
  const { data: farms } = await supabase.from('wind_farm').select('id, name');
  for (const farm of (farms || [])) {
    const { count } = await supabase.from('turbine').select('id', { count: 'exact', head: true }).eq('wind_farm_id', farm.id);
    if (count === 0) {
      await supabase.from('campaign').delete().eq('wind_farm_id', farm.id);
      await supabase.from('wind_farm').delete().eq('id', farm.id);
      console.log(`  Deleted empty farm: ${farm.name}`);
    }
  }

  // Final verification
  console.log('\n═══ VERIFICATION ═══');
  const { data: rt } = await supabase.from('turbine').select('id, name');
  console.log('Turbines:', rt?.length); rt?.forEach(t => console.log('  -', t.name));
  const { data: rb } = await supabase.from('blade').select('id');
  console.log('Blades:', rb?.length);
  const { data: ri } = await supabase.from('inspection').select('id');
  console.log('Inspections:', ri?.length);
  const { data: rf } = await supabase.from('wind_farm').select('id, name');
  console.log('Wind farms:', rf?.length); rf?.forEach(f => console.log('  -', f.name));

  process.exit(0);
}
main();
