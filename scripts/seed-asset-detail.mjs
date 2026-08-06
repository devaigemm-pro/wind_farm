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
  const adminId = authData.user.id;

  // ─── Wind Farm ID (Filo de Magocs) ────────────────────────────────────
  const WIND_FARM_ID = 'f0000000-0001-4000-8000-000000000001';

  // ─── Update turbine serial numbers and powering dates ─────────────────
  console.log('\n📋 Updating turbine serial numbers...');
  const turbineSerials = [
    { id: '10000000-0001-4000-8000-000000000001', serial_number: '48806', tower_serial_number: '', power_kw: 3000, powering_date: '2015-11-25T00:00:00Z', anticlockwise: false },
    { id: '10000000-0002-4000-8000-000000000002', serial_number: '48807', tower_serial_number: '', power_kw: 3000, powering_date: '2015-11-25T00:00:00Z', anticlockwise: false },
    { id: '10000000-0003-4000-8000-000000000003', serial_number: '48808', tower_serial_number: '', power_kw: 3000, powering_date: '2015-11-25T00:00:00Z', anticlockwise: false },
    { id: '10000000-0004-4000-8000-000000000004', serial_number: '48809', tower_serial_number: '', power_kw: 3000, powering_date: '2015-11-25T00:00:00Z', anticlockwise: false },
    { id: '10000000-0005-4000-8000-000000000005', serial_number: '48810', tower_serial_number: '', power_kw: 3000, powering_date: '2015-11-25T00:00:00Z', anticlockwise: false },
    { id: '10000000-0006-4000-8000-000000000006', serial_number: '48811', tower_serial_number: '', power_kw: 3000, powering_date: '2015-11-25T00:00:00Z', anticlockwise: false },
    { id: '10000000-0007-4000-8000-000000000007', serial_number: '48812', tower_serial_number: '', power_kw: 3000, powering_date: '2015-11-25T00:00:00Z', anticlockwise: false },
  ];

  for (const t of turbineSerials) {
    const { error } = await client.from('turbine').update({
      serial_number: t.serial_number,
      tower_serial_number: t.tower_serial_number,
      power_kw: t.power_kw,
      powering_date: t.powering_date,
      anticlockwise: t.anticlockwise,
    }).eq('id', t.id);
    if (error) console.error(`  Turbine ${t.id}:`, error.message);
  }
  console.log(`  ✓ ${turbineSerials.length} turbines updated`);

  // ─── Update blade serial numbers ──────────────────────────────────────
  console.log('\n📋 Updating blade serial numbers...');
  const { data: blades } = await client.from('blade').select('id, position, turbine_id').order('turbine_id').order('position');
  
  const bladeSerialMap = {
    '10000000-0001-4000-8000-000000000001': ['82618', '82612', '82615'],
    '10000000-0002-4000-8000-000000000002': ['82513', '82612', '82921'],
    '10000000-0003-4000-8000-000000000003': ['82518', '82617', '82609'],
    '10000000-0004-4000-8000-000000000004': ['82600', '82610', '82664'],
    '10000000-0005-4000-8000-000000000005': ['82907', '65861', '82689'],
    '10000000-0006-4000-8000-000000000006': ['82611', '82614', '82608'],
    '10000000-0007-4000-8000-000000000007': ['82868', '65867', '82688'],
  };

  let bladeCount = 0;
  for (const blade of (blades ?? [])) {
    const serials = bladeSerialMap[blade.turbine_id];
    if (serials && blade.position >= 1 && blade.position <= 3) {
      const { error } = await client.from('blade').update({
        serial_number: serials[blade.position - 1],
      }).eq('id', blade.id);
      if (error) console.error(`  Blade ${blade.id}:`, error.message);
      else bladeCount++;
    }
  }
  console.log(`  ✓ ${bladeCount} blades updated`);

  // ─── Update wind farm powering_date ───────────────────────────────────
  console.log('\n📋 Updating wind farm powering date...');
  const { error: wfErr } = await client.from('wind_farm').update({
    powering_date: '2015-11-25T00:00:00Z',
  }).eq('id', WIND_FARM_ID);
  if (wfErr) console.error('  Wind farm update error:', wfErr.message);
  else console.log('  ✓ Wind farm powering_date set to 11/25/2015');


  // ─── Create Campaigns ─────────────────────────────────────────────────
  console.log('\n📋 Creating campaigns...');
  const campaigns = [
    { name: 'June 2026 (Copy)', wind_farm_id: WIND_FARM_ID, created_by: adminId },
    { name: 'June 2026', wind_farm_id: WIND_FARM_ID, created_by: adminId },
    { name: 'Tests', wind_farm_id: WIND_FARM_ID, created_by: adminId },
  ];

  const { data: createdCampaigns, error: campErr } = await client
    .from('campaign')
    .upsert(campaigns.map((c, i) => ({ ...c, id: `c0000000-000${i + 1}-4000-8000-000000000001` })), { onConflict: 'id' })
    .select();
  
  if (campErr) {
    console.error('  Campaign error:', campErr.message);
  } else {
    console.log(`  ✓ ${createdCampaigns?.length ?? 0} campaigns created`);
  }

  // ─── Update inspections with campaign_id, type, photos, viewed ────────
  console.log('\n📋 Updating inspections with campaign data...');
  const { data: inspections } = await client
    .from('inspection')
    .select('id, blade_id')
    .order('created_at', { ascending: false })
    .limit(20);

  if (inspections && inspections.length > 0) {
    const campaignId = 'c0000000-0001-4000-8000-000000000001'; // June 2026 (Copy)
    const campaign2Id = 'c0000000-0002-4000-8000-000000000001'; // June 2026

    for (let i = 0; i < inspections.length; i++) {
      const insp = inspections[i];
      const assignedCampaign = i < 7 ? campaignId : (i < 14 ? campaign2Id : 'c0000000-0003-4000-8000-000000000001');
      const photoCounts = [498, 469, 418, 500, 489, 490, 456, 423, 467, 501];
      const defectCounts = [22, 36, 36, 22, 32, 28, 28, 18, 25, 30];
      
      const { error: updErr } = await client.from('inspection').update({
        campaign_id: assignedCampaign,
        inspection_type: 'blades',
        photos_count: photoCounts[i % photoCounts.length],
        viewed_percent: 100,
        notes: i === 0 ? 'Correct one' : null,
      }).eq('id', insp.id);
      
      if (updErr) console.error(`  Inspection ${insp.id}:`, updErr.message);
    }
    console.log(`  ✓ ${inspections.length} inspections updated with campaign data`);
  } else {
    console.log('  ⚠ No inspections found to update');
  }

  console.log('\n✅ Seed data for Asset Detail View complete!');
  console.log('   Navigate to /assets-wind/f0000000-0001-4000-8000-000000000001 to see the detail page.');
}

run().catch(console.error);
