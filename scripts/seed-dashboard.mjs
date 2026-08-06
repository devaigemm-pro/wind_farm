import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://esphlzrzwmzeozjmyvqm.supabase.co',
  'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v'
);

async function run() {
  // Sign in as admin
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'password123',
  });
  if (authError) {
    console.error('Auth Error:', authError.message);
    process.exit(1);
  }
  console.log('Signed in as:', authData.user.email);

  // Check existing data
  const { data: existingFarms } = await client.from('wind_farm').select('id, name');
  console.log('Existing wind farms:', existingFarms?.length ?? 0);

  // ─── Insert Wind Farms ────────────────────────────────────────────────
  const windFarms = [
    { id: 'f0000000-0001-4000-8000-000000000001', name: 'Filo de Magocs', location: 'Zaragoza, España', latitude: 41.6488, longitude: -0.8891 },
    { id: 'f0000000-0002-4000-8000-000000000002', name: 'Sierra del Madero', location: 'Soria, España', latitude: 41.7833, longitude: -2.1500 },
    { id: 'f0000000-0003-4000-8000-000000000003', name: 'Alto de la Degollada', location: 'Navarra, España', latitude: 42.6972, longitude: -1.7361 },
    { id: 'f0000000-0004-4000-8000-000000000004', name: 'Peña del Cuervo', location: 'Burgos, España', latitude: 42.3500, longitude: -3.7000 },
    { id: 'f0000000-0005-4000-8000-000000000005', name: 'Los Llanos de Aridane', location: 'Canarias, España', latitude: 28.6590, longitude: -17.9182 },
  ];

  const { error: farmError } = await client.from('wind_farm').upsert(windFarms, { onConflict: 'id' });
  if (farmError) {
    console.error('Wind Farm Error:', farmError.message);
    return;
  }
  console.log(`✓ ${windFarms.length} wind farms upserted`);

  // ─── Insert Turbines ──────────────────────────────────────────────────
  const turbines = [
    // Filo de Magocs - 7 turbines
    { id: '10000000-0001-4000-8000-000000000001', wind_farm_id: 'f0000000-0001-4000-8000-000000000001', name: 'FDM-T01', model: 'Vestas V150' },
    { id: '10000000-0002-4000-8000-000000000002', wind_farm_id: 'f0000000-0001-4000-8000-000000000001', name: 'FDM-T02', model: 'Vestas V150' },
    { id: '10000000-0003-4000-8000-000000000003', wind_farm_id: 'f0000000-0001-4000-8000-000000000001', name: 'FDM-T03', model: 'Vestas V150' },
    { id: '10000000-0004-4000-8000-000000000004', wind_farm_id: 'f0000000-0001-4000-8000-000000000001', name: 'FDM-T04', model: 'Vestas V150' },
    { id: '10000000-0005-4000-8000-000000000005', wind_farm_id: 'f0000000-0001-4000-8000-000000000001', name: 'FDM-T05', model: 'Vestas V150' },
    { id: '10000000-0006-4000-8000-000000000006', wind_farm_id: 'f0000000-0001-4000-8000-000000000001', name: 'FDM-T06', model: 'Vestas V150' },
    { id: '10000000-0007-4000-8000-000000000007', wind_farm_id: 'f0000000-0001-4000-8000-000000000001', name: 'FDM-T07', model: 'Vestas V150' },
    // Sierra del Madero - 5 turbines
    { id: '10000000-0008-4000-8000-000000000008', wind_farm_id: 'f0000000-0002-4000-8000-000000000002', name: 'SDM-T01', model: 'Siemens Gamesa SG 5.8' },
    { id: '10000000-0009-4000-8000-000000000009', wind_farm_id: 'f0000000-0002-4000-8000-000000000002', name: 'SDM-T02', model: 'Siemens Gamesa SG 5.8' },
    { id: '10000000-0010-4000-8000-000000000010', wind_farm_id: 'f0000000-0002-4000-8000-000000000002', name: 'SDM-T03', model: 'Siemens Gamesa SG 5.8' },
    { id: '10000000-0011-4000-8000-000000000011', wind_farm_id: 'f0000000-0002-4000-8000-000000000002', name: 'SDM-T04', model: 'Siemens Gamesa SG 5.8' },
    { id: '10000000-0012-4000-8000-000000000012', wind_farm_id: 'f0000000-0002-4000-8000-000000000002', name: 'SDM-T05', model: 'Siemens Gamesa SG 5.8' },
    // Alto de la Degollada - 4 turbines
    { id: '10000000-0013-4000-8000-000000000013', wind_farm_id: 'f0000000-0003-4000-8000-000000000003', name: 'ADD-T01', model: 'Nordex N163' },
    { id: '10000000-0014-4000-8000-000000000014', wind_farm_id: 'f0000000-0003-4000-8000-000000000003', name: 'ADD-T02', model: 'Nordex N163' },
    { id: '10000000-0015-4000-8000-000000000015', wind_farm_id: 'f0000000-0003-4000-8000-000000000003', name: 'ADD-T03', model: 'Nordex N163' },
    { id: '10000000-0016-4000-8000-000000000016', wind_farm_id: 'f0000000-0003-4000-8000-000000000003', name: 'ADD-T04', model: 'Nordex N163' },
    // Peña del Cuervo - 8 turbines
    { id: '10000000-0017-4000-8000-000000000017', wind_farm_id: 'f0000000-0004-4000-8000-000000000004', name: 'PDC-T01', model: 'Enercon E-126' },
    { id: '10000000-0018-4000-8000-000000000018', wind_farm_id: 'f0000000-0004-4000-8000-000000000004', name: 'PDC-T02', model: 'Enercon E-126' },
    { id: '10000000-0019-4000-8000-000000000019', wind_farm_id: 'f0000000-0004-4000-8000-000000000004', name: 'PDC-T03', model: 'Enercon E-126' },
    { id: '10000000-0020-4000-8000-000000000020', wind_farm_id: 'f0000000-0004-4000-8000-000000000004', name: 'PDC-T04', model: 'Enercon E-126' },
    { id: '10000000-0021-4000-8000-000000000021', wind_farm_id: 'f0000000-0004-4000-8000-000000000004', name: 'PDC-T05', model: 'Enercon E-126' },
    { id: '10000000-0022-4000-8000-000000000022', wind_farm_id: 'f0000000-0004-4000-8000-000000000004', name: 'PDC-T06', model: 'Enercon E-126' },
    { id: '10000000-0023-4000-8000-000000000023', wind_farm_id: 'f0000000-0004-4000-8000-000000000004', name: 'PDC-T07', model: 'Enercon E-126' },
    { id: '10000000-0024-4000-8000-000000000024', wind_farm_id: 'f0000000-0004-4000-8000-000000000004', name: 'PDC-T08', model: 'Enercon E-126' },
    // Los Llanos de Aridane - 3 turbines
    { id: '10000000-0025-4000-8000-000000000025', wind_farm_id: 'f0000000-0005-4000-8000-000000000005', name: 'LLA-T01', model: 'Vestas V236' },
    { id: '10000000-0026-4000-8000-000000000026', wind_farm_id: 'f0000000-0005-4000-8000-000000000005', name: 'LLA-T02', model: 'Vestas V236' },
    { id: '10000000-0027-4000-8000-000000000027', wind_farm_id: 'f0000000-0005-4000-8000-000000000005', name: 'LLA-T03', model: 'Vestas V236' },
  ];

  const { error: turbineError } = await client.from('turbine').upsert(turbines, { onConflict: 'id' });
  if (turbineError) {
    console.error('Turbine Error:', turbineError.message);
    return;
  }
  console.log(`✓ ${turbines.length} turbines upserted`);

  // Wait a bit for triggers to create blades
  await new Promise((r) => setTimeout(r, 2000));

  // ─── Fetch all blades ─────────────────────────────────────────────────
  const { data: allBlades, error: bladeError } = await client
    .from('blade')
    .select('id, turbine_id')
    .in('turbine_id', turbines.map((t) => t.id));

  if (bladeError || !allBlades?.length) {
    console.error('Blade fetch error:', bladeError?.message ?? 'No blades found');
    return;
  }
  console.log(`✓ ${allBlades.length} blades available (created by trigger)`);

  // ─── Get inspector ID ─────────────────────────────────────────────────
  const { data: profiles } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'inspector')
    .limit(1);

  const inspectorId = profiles?.[0]?.id ?? authData.user.id;
  console.log('Using inspector ID:', inspectorId);

  // ─── Create Inspections ───────────────────────────────────────────────
  // Map blades to their farm
  const turbineFarmMap = Object.fromEntries(turbines.map((t) => [t.id, t.wind_farm_id]));
  const farmBladesMap = {};
  for (const blade of allBlades) {
    const farmId = turbineFarmMap[blade.turbine_id];
    if (!farmBladesMap[farmId]) farmBladesMap[farmId] = [];
    farmBladesMap[farmId].push(blade.id);
  }

  // Define how many inspections per farm
  const inspectionCounts = {
    'f0000000-0001-4000-8000-000000000001': 14, // Filo de Magocs
    'f0000000-0002-4000-8000-000000000002': 10, // Sierra del Madero
    'f0000000-0003-4000-8000-000000000003': 8,  // Alto de la Degollada
    'f0000000-0004-4000-8000-000000000004': 22, // Peña del Cuervo
    'f0000000-0005-4000-8000-000000000005': 6,  // Los Llanos
  };

  const statuses = ['in_progress', 'completed', 'approved'];
  const inspections = [];
  let counter = 1;

  for (const [farmId, bladeIds] of Object.entries(farmBladesMap)) {
    const count = Math.min(inspectionCounts[farmId] ?? 5, bladeIds.length * 2);
    
    for (let i = 0; i < count; i++) {
      const bladeId = bladeIds[i % bladeIds.length];
      const status = statuses[i % 3];
      const stage = status === 'in_progress' ? (i % 2 === 0 ? 'uploaded' : 'annotated') : 'finalized';
      
      const year = 2022 + (i % 5);
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      inspections.push({
        id: `20000000-${String(counter).padStart(4, '0')}-4000-8000-000000000${String(counter).padStart(3, '0')}`,
        blade_id: bladeId,
        inspector_id: inspectorId,
        status,
        stage,
        scheduled_date: dateStr,
        completed_at: status !== 'in_progress' ? `${dateStr}T14:30:00Z` : null,
        approved_by: status === 'approved' ? inspectorId : null,
        approved_at: status === 'approved' ? `${dateStr}T16:00:00Z` : null,
      });
      counter++;
    }
  }

  // Insert in batches of 20
  for (let i = 0; i < inspections.length; i += 20) {
    const batch = inspections.slice(i, i + 20);
    const { error: inspError } = await client.from('inspection').upsert(batch, { onConflict: 'id' });
    if (inspError) {
      console.error(`Inspection batch ${i / 20 + 1} error:`, inspError.message);
    }
  }
  console.log(`✓ ${inspections.length} inspections upserted`);

  // ─── Verify ───────────────────────────────────────────────────────────
  console.log('\n─── Verification ───');
  const { data: verifyFarms } = await client.from('wind_farm').select('id, name');
  console.log(`Wind Farms: ${verifyFarms?.length}`);
  
  const { data: verifyTurbines } = await client.from('turbine').select('id').in('wind_farm_id', windFarms.map(f => f.id));
  console.log(`Turbines: ${verifyTurbines?.length}`);
  
  const { data: verifyBlades } = await client.from('blade').select('id');
  console.log(`Blades: ${verifyBlades?.length}`);
  
  const { data: verifyInsp } = await client.from('inspection').select('id');
  console.log(`Inspections: ${verifyInsp?.length}`);

  console.log('\n✓ Seed complete! The Wind Farms Dashboard should now display data.');
}

run().catch(console.error);
