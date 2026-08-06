/**
 * Seed defects for turbine ADD-T02 (10000000-0014-4000-8000-000000000014)
 * from wind farm "Alto de la Degollada" (f0000000-0003-4000-8000-000000000003).
 * 
 * Creates finalized inspections and defects similar to Skyvisor data.
 * Run: node scripts/seed-turbine-defects.mjs
 */
import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://esphlzrzwmzeozjmyvqm.supabase.co',
  'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v'
);

const TURBINE_ID = '10000000-0014-4000-8000-000000000014';

async function run() {
  // Auth
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'password123',
  });
  if (authError) {
    console.error('Auth Error:', authError.message);
    process.exit(1);
  }
  console.log('Signed in as:', authData.user.email);

  // Get blades for ADD-T02
  const { data: blades, error: bladeErr } = await client
    .from('blade')
    .select('id, position, serial_number')
    .eq('turbine_id', TURBINE_ID)
    .order('position');

  if (bladeErr || !blades?.length) {
    console.error('No blades found for turbine:', bladeErr?.message);
    return;
  }
  console.log(`Found ${blades.length} blades:`, blades.map(b => `pos${b.position}=${b.id.substring(0,8)}`));

  const bladeA = blades.find(b => b.position === 1);
  const bladeB = blades.find(b => b.position === 2);
  const bladeC = blades.find(b => b.position === 3);

  if (!bladeA || !bladeB || !bladeC) {
    console.error('Need 3 blades (positions 1,2,3)');
    return;
  }

  // Get inspector
  const { data: profiles } = await client.from('profiles').select('id').eq('role', 'inspector').limit(1);
  const inspectorId = profiles?.[0]?.id ?? authData.user.id;

  // Create finalized inspections for each blade
  const inspections = [
    {
      id: '30000000-0001-4000-8000-000000000001',
      blade_id: bladeA.id,
      inspector_id: inspectorId,
      status: 'completed',
      stage: 'finalized',
      scheduled_date: '2026-07-01',
      completed_at: '2026-07-03T14:30:00Z',
    },
    {
      id: '30000000-0002-4000-8000-000000000002',
      blade_id: bladeB.id,
      inspector_id: inspectorId,
      status: 'completed',
      stage: 'finalized',
      scheduled_date: '2026-07-01',
      completed_at: '2026-07-03T15:00:00Z',
    },
    {
      id: '30000000-0003-4000-8000-000000000003',
      blade_id: bladeC.id,
      inspector_id: inspectorId,
      status: 'completed',
      stage: 'finalized',
      scheduled_date: '2026-07-01',
      completed_at: '2026-07-03T15:30:00Z',
    },
  ];

  // Create inspections as in_progress first (RLS requires this for defect insertion)
  const inspectionsInitial = inspections.map(i => ({
    ...i,
    status: 'in_progress',
    stage: 'uploaded',
    completed_at: null,
  }));

  const { error: inspErr } = await client.from('inspection').upsert(inspectionsInitial, { onConflict: 'id' });
  if (inspErr) {
    console.error('Inspection upsert error:', inspErr.message);
    return;
  }
  console.log(`✓ ${inspections.length} inspections created (in_progress)`);

  // Sign in as inspector to insert defects (RLS requires inspector who owns the inspection)
  const { data: inspAuth, error: inspAuthErr } = await client.auth.signInWithPassword({
    email: 'inspector@windfarm.dev',
    password: 'password123',
  });
  if (inspAuthErr) {
    console.error('Inspector auth error:', inspAuthErr.message);
    return;
  }
  console.log('Switched to inspector:', inspAuth.user.email);

  // Create defects — matching Skyvisor patterns (22 defects across 3 blades)
  const defects = [
    // Blade A (position 1) — 4 defects
    { id: 'df000000-0001-4000-8000-000000000001', inspection_id: inspections[0].id, type: 'vortex', severity: 3, distance_from_root: 29.7, description: 'Vortex generators missing, intermittent loss' },
    { id: 'df000000-0002-4000-8000-000000000002', inspection_id: inspections[0].id, type: 'le_erosion', severity: 3, distance_from_root: 33.5, description: 'Moderate leading edge erosion' },
    { id: 'df000000-0003-4000-8000-000000000003', inspection_id: inspections[0].id, type: 'le_erosion', severity: 3, distance_from_root: 37.6, description: 'Light erosion in mid-zone' },
    { id: 'df000000-0004-4000-8000-000000000004', inspection_id: inspections[0].id, type: 'le_erosion', severity: 4, distance_from_root: 40.6, description: 'Severe erosion requiring immediate action' },
    // Blade B (position 2) — 7 defects
    { id: 'df000000-0005-4000-8000-000000000005', inspection_id: inspections[1].id, type: 'vortex', severity: 3, distance_from_root: 31.0, description: 'Missing vortex panels in mid-section' },
    { id: 'df000000-0006-4000-8000-000000000006', inspection_id: inspections[1].id, type: 'le_erosion', severity: 3, distance_from_root: 34.7, description: 'Extended linear erosion' },
    { id: 'df000000-0007-4000-8000-000000000007', inspection_id: inspections[1].id, type: 'vortex', severity: 3, distance_from_root: 35.2, description: 'Multiple detached panels' },
    { id: 'df000000-0008-4000-8000-000000000008', inspection_id: inspections[1].id, type: 'le_erosion', severity: 3, distance_from_root: 38.8, description: 'Moderate erosion' },
    { id: 'df000000-0009-4000-8000-000000000009', inspection_id: inspections[1].id, type: 'vortex', severity: 3, distance_from_root: 39.2, description: 'Individual missing panel' },
    { id: 'df000000-0010-4000-8000-000000000010', inspection_id: inspections[1].id, type: 'le_erosion', severity: 3, distance_from_root: 41.6, description: 'Tip erosion' },
    { id: 'df000000-0011-4000-8000-000000000011', inspection_id: inspections[1].id, type: 'vortex', severity: 3, distance_from_root: 42.2, description: 'Missing panels in tip zone' },
    // Blade C (position 3) — 11 defects
    { id: 'df000000-0012-4000-8000-000000000012', inspection_id: inspections[2].id, type: 'other', severity: 4, distance_from_root: 0, description: 'Protection add-on missing at root' },
    { id: 'df000000-0013-4000-8000-000000000013', inspection_id: inspections[2].id, type: 'le_erosion', severity: 3, distance_from_root: 28.4, description: 'Extended leading edge erosion' },
    { id: 'df000000-0014-4000-8000-000000000014', inspection_id: inspections[2].id, type: 'vortex', severity: 3, distance_from_root: 28.9, description: 'Absent vortex generators' },
    { id: 'df000000-0015-4000-8000-000000000015', inspection_id: inspections[2].id, type: 'le_erosion', severity: 3, distance_from_root: 33.6, description: 'Deep erosion' },
    { id: 'df000000-0016-4000-8000-000000000016', inspection_id: inspections[2].id, type: 'vortex', severity: 3, distance_from_root: 33.9, description: 'Minor absent panel' },
    { id: 'df000000-0017-4000-8000-000000000017', inspection_id: inspections[2].id, type: 'vortex', severity: 3, distance_from_root: 37.8, description: 'Multiple missing panels in upper-mid zone' },
    { id: 'df000000-0018-4000-8000-000000000018', inspection_id: inspections[2].id, type: 'le_erosion', severity: 3, distance_from_root: 38.5, description: 'Extended tip erosion' },
    { id: 'df000000-0019-4000-8000-000000000019', inspection_id: inspections[2].id, type: 'paint_defect', severity: 3, distance_from_root: 39.8, description: 'Localized paint damage' },
    { id: 'df000000-0020-4000-8000-000000000020', inspection_id: inspections[2].id, type: 'le_erosion', severity: 4, distance_from_root: 41.4, description: 'Severe LE erosion' },
    { id: 'df000000-0021-4000-8000-000000000021', inspection_id: inspections[2].id, type: 'le_erosion', severity: 3, distance_from_root: 42.4, description: 'Moderate erosion near tip' },
    { id: 'df000000-0022-4000-8000-000000000022', inspection_id: inspections[2].id, type: 'lightning_damage', severity: 4, distance_from_root: 42.7, description: 'Lightning receptor damage with hydraulic oil contamination' },
  ];

  const { error: defErr } = await client.from('defect').upsert(defects, { onConflict: 'id' });
  if (defErr) {
    console.error('Defect upsert error:', defErr.message);
    return;
  }
  console.log(`✓ ${defects.length} defects created (Blade A: 4, Blade B: 7, Blade C: 11)`);

  // Now switch back to admin and finalize the inspections
  await client.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'password123',
  });

  for (const insp of inspections) {
    const { error: updErr } = await client
      .from('inspection')
      .update({ status: 'completed', stage: 'finalized', completed_at: insp.completed_at })
      .eq('id', insp.id);
    if (updErr) {
      console.error(`Failed to finalize ${insp.id}:`, updErr.message);
    }
  }
  console.log(`✓ ${inspections.length} inspections finalized`);

  // Verify
  const { data: verify } = await client
    .from('defect')
    .select('id, type, severity')
    .in('inspection_id', inspections.map(i => i.id));
  console.log(`\n✓ Verification: ${verify?.length} defects in DB for ADD-T02`);
  console.log('Done! TurbineDetail should now show real data for:');
  console.log('  /assets-wind/f0000000-0003-4000-8000-000000000003/turbine/10000000-0014-4000-8000-000000000014');
}

run().catch(console.error);
