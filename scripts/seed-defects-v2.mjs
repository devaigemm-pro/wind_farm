import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://esphlzrzwmzeozjmyvqm.supabase.co',
  'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v'
);

async function run() {
  // Sign in as inspector (who owns the inspections)
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'inspector@windfarm.dev',
    password: 'password123',
  });
  if (authError) {
    console.error('Inspector login failed, trying admin:', authError.message);
    // Fallback to admin
    const { data: adminAuth, error: adminErr } = await client.auth.signInWithPassword({
      email: 'admin@windfarm.dev',
      password: 'password123',
    });
    if (adminErr) { console.error('Admin login also failed'); process.exit(1); }
    console.log('Signed in as admin (will try to insert via RLS bypass)');
  } else {
    console.log('Signed in as:', authData.user.email, '(ID:', authData.user.id + ')');
  }

  const { data: { user } } = await client.auth.getUser();
  const userId = user.id;
  console.log('Current user ID:', userId);

  // Get inspections owned by this user that are in_progress
  const { data: myInspections, error: inspErr } = await client
    .from('inspection')
    .select('id, blade_id, status, inspector_id')
    .eq('inspector_id', userId)
    .eq('status', 'in_progress');

  if (inspErr) {
    console.error('Error fetching inspections:', inspErr.message);
    process.exit(1);
  }

  console.log(`Found ${myInspections?.length ?? 0} in-progress inspections owned by current user`);

  // If no inspections, try all in_progress inspections
  let inspections = myInspections;
  if (!inspections?.length) {
    console.log('No in-progress inspections owned by user, trying all in_progress...');
    const { data: allInsp } = await client
      .from('inspection')
      .select('id, blade_id, status, inspector_id')
      .eq('status', 'in_progress');
    inspections = allInsp ?? [];
    console.log(`Found ${inspections.length} total in-progress inspections`);
    
    if (!inspections.length) {
      // Use any inspections
      const { data: anyInsp } = await client
        .from('inspection')
        .select('id, blade_id, status, inspector_id')
        .limit(60);
      inspections = anyInsp ?? [];
      console.log(`Using ${inspections.length} inspections (any status)`);
    }
  }

  // Define realistic defect data
  const defectTypes = ['le_erosion', 'vortex', 'paint_defect', 'crack', 'delamination', 'lightning_damage', 'other'];
  const sides = ['LE', 'SS', 'TE', 'PS'];
  const actionTexts = {
    high: 'Repair within next 3 months',
    medium: 'Repair within next 6 months',
    low: 'Monitor in next inspection',
  };
  const nextSteps = [
    'Reparar de forma previa a daños en terrazados',
    'Instalar vortex nuevos',
    'Corregir dentro de tres meses',
    'Preparar superficie a nuevos vortex nuevos',
    'Reparar daño a evaluar BA antes de tres meses',
    'Reparar de forma previa a daños en terrazados antes de seis meses',
    'Inspeccionar nuevamente y evaluar por operador lo antes posible',
    'Instalar paneles faltantes en próxima intervención',
    'Repintar zona afectada en próximo mantenimiento',
    'Evaluar estructuralmente antes de 30 días',
  ];
  const rootCauses = [
    'Daño por operación',
    'Erosión natural por partículas',
    'Impacto de rayo',
    'Defecto de fabricación',
    'Fatiga del material',
    'Exposición UV prolongada',
    'Vibración excesiva',
    'Impacto de ave',
    'Desgaste por hielo',
    'Fallo de adhesivo',
  ];
  const notesOptions = [
    'Daño cosmético en superficie de BA',
    'Requiere inspección con dron para confirmar extensión',
    'Defecto progresivo detectado en inspección anterior',
    'Zona de alta incidencia de erosión',
    'Posible propagación hacia trailing edge',
    'Material compuesto comprometido',
    'Primer registro del defecto',
    'Defecto estabilizado desde última inspección',
    null,
    null,
  ];

  // Generate and insert defects
  let totalInserted = 0;
  let defectIds = [];

  for (let i = 0; i < inspections.length; i++) {
    const inspection = inspections[i];
    const numDefects = 3 + Math.floor(Math.random() * 6);
    const batch = [];

    for (let j = 0; j < numDefects; j++) {
      const severity = Math.random() > 0.6 ? (Math.random() > 0.5 ? 4 : 5) : 3;
      const urgency = severity >= 4 ? 'high' : (Math.random() > 0.5 ? 'medium' : 'low');
      const type = defectTypes[Math.floor(Math.random() * defectTypes.length)];
      const side = sides[Math.floor(Math.random() * sides.length)];
      const width = Math.floor(Math.random() * 600) + 3;
      const height = Math.floor(Math.random() * 500) + 3;
      const distance = Math.round((Math.random() * 55 + 5) * 100) / 100;

      batch.push({
        inspection_id: inspection.id,
        type,
        severity,
        distance_from_root: distance,
        description: `${type.replace(/_/g, ' ')} detected at ${distance}m`,
        width_cm: width,
        height_cm: height,
        side,
        action_text: actionTexts[urgency],
        action_urgency: urgency,
        next_step: nextSteps[Math.floor(Math.random() * nextSteps.length)],
        root_cause: rootCauses[Math.floor(Math.random() * rootCauses.length)],
        notes: notesOptions[Math.floor(Math.random() * notesOptions.length)],
        resolved: Math.random() > 0.85,
      });
    }

    const { data: inserted, error } = await client.from('defect').insert(batch).select('id');
    if (error) {
      if (i === 0) console.error('Insert error (first batch):', error.message);
      // Skip silently for RLS issues on non-owned inspections
    } else {
      totalInserted += inserted.length;
      defectIds.push(...inserted.map(d => d.id));
    }
  }

  console.log(`\n✓ ${totalInserted} defects inserted`);

  // Insert comments for the defects we successfully created
  if (defectIds.length > 0) {
    console.log('\n─── Creating comments ───');
    const commentTexts = [
      'Defect created',
      'Revisado en campo - confirma dimensiones',
      'Se programa intervención para próximo mes',
      'Pendiente de materiales para reparación',
      'Fotos adicionales tomadas con dron',
      'Supervisado - no requiere acción inmediata',
      'Reparación completada parcialmente',
      'Escalado a equipo de ingeniería',
      'Defecto monitoreado - sin cambios desde última revisión',
      'Aprobada orden de trabajo para reparación',
    ];

    let commentsInserted = 0;
    const commentBatch = [];

    for (const defectId of defectIds.slice(0, 80)) {
      const numComments = 1 + Math.floor(Math.random() * 2);
      for (let c = 0; c < numComments; c++) {
        commentBatch.push({
          defect_id: defectId,
          author_id: userId,
          text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
        });
      }
    }

    // Insert comments in batches
    for (let i = 0; i < commentBatch.length; i += 20) {
      const batch = commentBatch.slice(i, i + 20);
      const { error: comErr } = await client.from('defect_comment').insert(batch);
      if (comErr) {
        console.error('Comment insert error:', comErr.message);
        break;
      }
      commentsInserted += batch.length;
    }
    console.log(`✓ ${commentsInserted} comments inserted`);
  }

  // Update turbine models
  console.log('\n─── Updating turbine models ───');
  const models = [
    { pattern: 'FDM-', model: 'Vestas V90' },
    { pattern: 'SDM-', model: 'Siemens Gamesa SG 5.8' },
    { pattern: 'ADD-', model: 'Nordex N163' },
    { pattern: 'PDC-', model: 'Enercon E-126' },
    { pattern: 'LLA-', model: 'Vestas V236' },
  ];
  for (const m of models) {
    await client.from('turbine').update({ model: m.model }).like('name', `${m.pattern}%`);
  }
  console.log('✓ Turbine models updated');

  // Final verification
  console.log('\n─── Verification ───');
  const { count } = await client.from('defect').select('*', { count: 'exact', head: true });
  console.log(`Total defects: ${count}`);
  
  const { data: rpcTest } = await client.rpc('get_defects_dashboard', { p_search: '', p_limit: 5, p_offset: 0, p_sort_field: 'asset_name', p_sort_dir: 'asc' });
  console.log(`RPC returns: ${rpcTest?.length} rows (sample)`);
  if (rpcTest?.[0]) {
    console.log(`  First row: ${rpcTest[0].asset_name} / ${rpcTest[0].turbine_name} / ${rpcTest[0].defect_type}`);
  }

  console.log('\n✓ Done! Refresh the app to see defects in the Defects tab.');
}

run().catch(console.error);
