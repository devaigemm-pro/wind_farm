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

  // ─── PASO 1: Consultar datos existentes ───────────────────────────────
  console.log('\n─── PASO 1: Consultar datos existentes ───');

  const { data: farms } = await client.from('wind_farm').select('id, name');
  console.log('Wind farms:', farms?.map(f => `${f.name} (${f.id})`));

  const { data: turbines } = await client.from('turbine').select('id, name, wind_farm_id, latitude, longitude').order('wind_farm_id').order('name');
  console.log(`Turbines: ${turbines?.length}`);
  for (const t of turbines || []) {
    console.log(`  ${t.name} | farm=${t.wind_farm_id} | lat=${t.latitude} lon=${t.longitude}`);
  }

  const { data: campaigns } = await client.from('campaign').select('id, name, wind_farm_id');
  console.log('Existing campaigns:', campaigns);

  const { data: inspections } = await client.from('inspection').select('id, blade_id, campaign_id, stage').limit(20);
  console.log(`Inspections sample (first 20):`, inspections?.length);
  const withCampaign = inspections?.filter(i => i.campaign_id);
  console.log(`  With campaign_id: ${withCampaign?.length}`);

  // ─── PASO 2: Crear campañas ───────────────────────────────────────────
  console.log('\n─── PASO 2: Crear campañas ───');

  // Use the main wind farm (Filo de Magocs)
  const mainFarmId = 'f0000000-0001-4000-8000-000000000001';

  const campaignData = [
    { id: 'c0000000-0001-4000-8000-000000000001', name: 'June 2026', wind_farm_id: mainFarmId },
    { id: 'c0000000-0002-4000-8000-000000000002', name: 'June 2026 (Copy)', wind_farm_id: mainFarmId },
  ];

  const { error: campError } = await client.from('campaign').upsert(campaignData, { onConflict: 'id' });
  if (campError) {
    console.error('Campaign insert error:', campError.message);
    // Try without specifying IDs in case of conflict
    const { error: campError2 } = await client.from('campaign').insert(
      campaignData.map(c => ({ name: c.name, wind_farm_id: c.wind_farm_id }))
    );
    if (campError2) {
      console.error('Campaign insert retry error:', campError2.message);
    } else {
      console.log('✓ Campaigns created (without specified IDs)');
    }
  } else {
    console.log('✓ 2 campaigns upserted');
  }

  // Fetch campaign IDs
  const { data: allCampaigns } = await client.from('campaign').select('id, name, wind_farm_id');
  console.log('All campaigns now:', allCampaigns);

  if (!allCampaigns || allCampaigns.length < 2) {
    console.error('Not enough campaigns available. Aborting.');
    return;
  }

  const campaign1Id = allCampaigns[0].id;
  const campaign2Id = allCampaigns[1].id;
  console.log(`Campaign 1: ${allCampaigns[0].name} (${campaign1Id})`);
  console.log(`Campaign 2: ${allCampaigns[1].name} (${campaign2Id})`);

  // ─── PASO 3: Asignar inspecciones a campañas ──────────────────────────
  console.log('\n─── PASO 3: Asignar inspecciones a campañas ───');

  // Get all blades for the main wind farm turbines
  const mainFarmTurbineIds = turbines
    ?.filter(t => t.wind_farm_id === mainFarmId)
    .map(t => t.id) || [];
  
  console.log(`Main farm turbine IDs: ${mainFarmTurbineIds.length}`);

  const { data: mainBlades } = await client
    .from('blade')
    .select('id, turbine_id')
    .in('turbine_id', mainFarmTurbineIds);

  console.log(`Main farm blades: ${mainBlades?.length}`);
  const mainBladeIds = mainBlades?.map(b => b.id) || [];

  // Get all inspections for those blades
  const { data: mainInspections } = await client
    .from('inspection')
    .select('id, blade_id, created_at')
    .in('blade_id', mainBladeIds)
    .order('created_at');

  console.log(`Main farm inspections: ${mainInspections?.length}`);

  if (mainInspections && mainInspections.length > 0) {
    const half = Math.ceil(mainInspections.length / 2);
    const firstHalf = mainInspections.slice(0, half).map(i => i.id);
    const secondHalf = mainInspections.slice(half).map(i => i.id);

    console.log(`Assigning ${firstHalf.length} inspections to campaign 1...`);
    // Update in batches of 50
    for (let i = 0; i < firstHalf.length; i += 50) {
      const batch = firstHalf.slice(i, i + 50);
      const { error } = await client
        .from('inspection')
        .update({ campaign_id: campaign1Id })
        .in('id', batch);
      if (error) console.error(`Batch ${i} error:`, error.message);
    }

    console.log(`Assigning ${secondHalf.length} inspections to campaign 2...`);
    for (let i = 0; i < secondHalf.length; i += 50) {
      const batch = secondHalf.slice(i, i + 50);
      const { error } = await client
        .from('inspection')
        .update({ campaign_id: campaign2Id })
        .in('id', batch);
      if (error) console.error(`Batch ${i} error:`, error.message);
    }

    console.log('✓ Inspections assigned to campaigns');
  } else {
    console.log('No inspections found for main farm. Trying all inspections...');
    
    const { data: allInspections } = await client
      .from('inspection')
      .select('id')
      .order('created_at');

    if (allInspections && allInspections.length > 0) {
      const half = Math.ceil(allInspections.length / 2);
      const firstHalf = allInspections.slice(0, half).map(i => i.id);
      const secondHalf = allInspections.slice(half).map(i => i.id);

      for (let i = 0; i < firstHalf.length; i += 50) {
        const batch = firstHalf.slice(i, i + 50);
        await client.from('inspection').update({ campaign_id: campaign1Id }).in('id', batch);
      }
      for (let i = 0; i < secondHalf.length; i += 50) {
        const batch = secondHalf.slice(i, i + 50);
        await client.from('inspection').update({ campaign_id: campaign2Id }).in('id', batch);
      }
      console.log(`✓ ${allInspections.length} inspections distributed between campaigns`);
    }
  }

  // ─── PASO 4: Cargar coordenadas de turbinas ───────────────────────────
  console.log('\n─── PASO 4: Cargar coordenadas de turbinas ───');

  // Filo de Magocs is in Zaragoza, Spain (lat ~41.65, lon ~-0.89)
  // Spread turbines along a ridge line NE-SW direction
  const filoCoords = [
    { name: 'FDM-T01', latitude: 41.6520, longitude: -0.8920 },
    { name: 'FDM-T02', latitude: 41.6505, longitude: -0.8905 },
    { name: 'FDM-T03', latitude: 41.6490, longitude: -0.8890 },
    { name: 'FDM-T04', latitude: 41.6475, longitude: -0.8875 },
    { name: 'FDM-T05', latitude: 41.6460, longitude: -0.8860 },
    { name: 'FDM-T06', latitude: 41.6445, longitude: -0.8845 },
    { name: 'FDM-T07', latitude: 41.6430, longitude: -0.8830 },
  ];

  // Sierra del Madero in Soria, Spain (lat ~41.78, lon ~-2.15)
  const sierraCoords = [
    { name: 'SDM-T01', latitude: 41.7860, longitude: -2.1530 },
    { name: 'SDM-T02', latitude: 41.7845, longitude: -2.1515 },
    { name: 'SDM-T03', latitude: 41.7830, longitude: -2.1500 },
    { name: 'SDM-T04', latitude: 41.7815, longitude: -2.1485 },
    { name: 'SDM-T05', latitude: 41.7800, longitude: -2.1470 },
  ];

  // Alto de la Degollada in Navarra, Spain (lat ~42.70, lon ~-1.74)
  const altoCoords = [
    { name: 'ADD-T01', latitude: 42.6990, longitude: -1.7380 },
    { name: 'ADD-T02', latitude: 42.6975, longitude: -1.7365 },
    { name: 'ADD-T03', latitude: 42.6960, longitude: -1.7350 },
    { name: 'ADD-T04', latitude: 42.6945, longitude: -1.7335 },
  ];

  // Peña del Cuervo in Burgos, Spain (lat ~42.35, lon ~-3.70)
  const penaCoords = [
    { name: 'PDC-T01', latitude: 42.3540, longitude: -3.7040 },
    { name: 'PDC-T02', latitude: 42.3525, longitude: -3.7025 },
    { name: 'PDC-T03', latitude: 42.3510, longitude: -3.7010 },
    { name: 'PDC-T04', latitude: 42.3495, longitude: -3.6995 },
    { name: 'PDC-T05', latitude: 42.3480, longitude: -3.6980 },
    { name: 'PDC-T06', latitude: 42.3465, longitude: -3.6965 },
    { name: 'PDC-T07', latitude: 42.3450, longitude: -3.6950 },
    { name: 'PDC-T08', latitude: 42.3435, longitude: -3.6935 },
  ];

  // Los Llanos de Aridane in Canarias, Spain (lat ~28.66, lon ~-17.92)
  const llanosCoords = [
    { name: 'LLA-T01', latitude: 28.6610, longitude: -17.9200 },
    { name: 'LLA-T02', latitude: 28.6595, longitude: -17.9185 },
    { name: 'LLA-T03', latitude: 28.6580, longitude: -17.9170 },
  ];

  const allCoords = [...filoCoords, ...sierraCoords, ...altoCoords, ...penaCoords, ...llanosCoords];

  for (const coord of allCoords) {
    const turbine = turbines?.find(t => t.name === coord.name);
    if (turbine) {
      const { error } = await client
        .from('turbine')
        .update({ latitude: coord.latitude, longitude: coord.longitude })
        .eq('id', turbine.id);
      if (error) {
        console.error(`Error updating ${coord.name}:`, error.message);
      }
    } else {
      console.warn(`Turbine ${coord.name} not found in database`);
    }
  }
  console.log(`✓ Coordinates assigned to ${allCoords.length} turbines`);

  // ─── PASO 5: Verificar ────────────────────────────────────────────────
  console.log('\n─── PASO 5: Verificación ───');

  const { data: verifyCampaigns } = await client.from('campaign').select('id, name, wind_farm_id');
  console.log('Campaigns:', verifyCampaigns);

  const { data: verifyInspCampaigns } = await client
    .from('inspection')
    .select('campaign_id')
    .not('campaign_id', 'is', null);
  
  // Count by campaign
  const campaignCounts = {};
  for (const i of verifyInspCampaigns || []) {
    campaignCounts[i.campaign_id] = (campaignCounts[i.campaign_id] || 0) + 1;
  }
  console.log('Inspections per campaign:', campaignCounts);

  const { data: verifyCoords } = await client
    .from('turbine')
    .select('name, latitude, longitude')
    .not('latitude', 'is', null);
  console.log(`Turbines with coordinates: ${verifyCoords?.length}`);
  for (const t of verifyCoords || []) {
    console.log(`  ${t.name}: lat=${t.latitude}, lon=${t.longitude}`);
  }

  console.log('\n✓ Seed complete!');
}

run().catch(console.error);
