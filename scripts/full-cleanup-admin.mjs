/**
 * Full cleanup with service_role key (bypasses RLS).
 * Deletes everything NOT related to FDM-T02 in correct FK order.
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

  // Get blade IDs for FDM-T02 (to KEEP)
  const { data: keepBlades } = await supabase.from('blade').select('id').eq('turbine_id', FDM_T02_ID);
  const keepBladeIds = (keepBlades || []).map(b => b.id);
  console.log(`FDM-T02 blades to keep: ${keepBladeIds.length}`);

  // Get ALL blades to delete
  const { data: allBlades } = await supabase.from('blade').select('id').neq('turbine_id', FDM_T02_ID);
  const deleteBladeIds = (allBlades || []).map(b => b.id);
  console.log(`Blades to delete: ${deleteBladeIds.length}`);

  if (deleteBladeIds.length === 0) {
    console.log('Nothing to delete.');
    process.exit(0);
  }

  // Get ALL inspections for blades to delete
  const { data: inspections } = await supabase.from('inspection').select('id').in('blade_id', deleteBladeIds);
  const inspIds = (inspections || []).map(i => i.id);
  console.log(`Inspections to delete: ${inspIds.length}`);

  // 1. Delete annotations
  if (inspIds.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < inspIds.length; i += BATCH) {
      const batch = inspIds.slice(i, i + BATCH);
      await supabase.from('annotation').delete().in('inspection_id', batch);
    }
    console.log('✓ annotations deleted');
  }

  // 2. Delete defect_image for defects of these inspections
  if (inspIds.length > 0) {
    const { data: defects } = await supabase.from('defect').select('id').in('inspection_id', inspIds);
    const defectIds = (defects || []).map(d => d.id);
    if (defectIds.length > 0) {
      await supabase.from('defect_image').delete().in('defect_id', defectIds);
      await supabase.from('evidence').delete().in('defect_id', defectIds);
      await supabase.from('defect').delete().in('id', defectIds);
      console.log(`✓ ${defectIds.length} defects + images + evidence deleted`);
    }
  }

  // 3. Delete inspection_photo for these blades
  if (deleteBladeIds.length > 0) {
    const BATCH = 30;
    for (let i = 0; i < deleteBladeIds.length; i += BATCH) {
      const batch = deleteBladeIds.slice(i, i + BATCH);
      await supabase.from('inspection_photo').delete().in('blade_id', batch);
    }
    console.log('✓ inspection_photo deleted');
  }

  // 4. Delete inspections
  if (inspIds.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < inspIds.length; i += BATCH) {
      const batch = inspIds.slice(i, i + BATCH);
      await supabase.from('inspection').delete().in('id', batch);
    }
    console.log('✓ inspections deleted');
  }

  // 5. Delete blades
  const BATCH = 50;
  for (let i = 0; i < deleteBladeIds.length; i += BATCH) {
    const batch = deleteBladeIds.slice(i, i + BATCH);
    const { error } = await supabase.from('blade').delete().in('id', batch);
    if (error) { console.error('Blade batch error:', error.message); process.exit(1); }
  }
  console.log('✓ blades deleted');

  // 6. Delete turbines (except FDM-T02)
  const { data: delTurb, error: tErr } = await supabase.from('turbine').delete().neq('id', FDM_T02_ID).select('id, name');
  if (tErr) { console.error('Turbine error:', tErr.message); process.exit(1); }
  console.log(`✓ ${delTurb?.length ?? 0} turbines deleted`);

  // 7. Delete wind farms with no turbines left
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
  const { data: rb } = await supabase.from('blade').select('id, turbine_id');
  console.log('Blades:', rb?.length);
  const { data: ri } = await supabase.from('inspection').select('id');
  console.log('Inspections:', ri?.length);
  const { data: rf } = await supabase.from('wind_farm').select('id, name');
  console.log('Wind farms:', rf?.length); rf?.forEach(f => console.log('  -', f.name));

  process.exit(0);
}
main();
