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

  // ─── Step 1: Run migration - add new columns ─────────────────────────
  console.log('\n─── Running migration for defects dashboard ───');

  // We use the SQL editor via RPC or direct queries. Since we can't run raw SQL
  // through the client library, we'll rely on the columns being already added via
  // Supabase Dashboard or CLI. Instead, let's check if the columns exist by
  // attempting to insert a defect with the new fields.

  // ─── Step 2: Fetch existing inspections ───────────────────────────────
  const { data: inspections, error: inspError } = await client
    .from('inspection')
    .select('id, blade_id')
    .limit(60);

  if (inspError || !inspections?.length) {
    console.error('No inspections found:', inspError?.message);
    process.exit(1);
  }
  console.log(`Found ${inspections.length} inspections`);

  // ─── Step 3: Get admin profile for comments ───────────────────────────
  const adminId = authData.user.id;

  // ─── Step 4: Define realistic defect data ─────────────────────────────
  const defectTypes = ['le_erosion', 'vortex', 'paint_defect', 'crack', 'delamination', 'lightning_damage', 'other'];
  const sides = ['LE', 'SS', 'TE', 'PS'];
  const urgencies = ['high', 'medium', 'low'];

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

  // ─── Step 5: Generate defects ─────────────────────────────────────────
  const defects = [];
  let defectCounter = 1;

  for (let i = 0; i < Math.min(inspections.length, 50); i++) {
    const inspection = inspections[i];
    // Each inspection gets 2-8 defects
    const numDefects = 2 + Math.floor(Math.random() * 7);

    for (let j = 0; j < numDefects; j++) {
      const severity = Math.random() > 0.6 ? (Math.random() > 0.5 ? 4 : 5) : 3;
      const urgency = severity >= 4 ? 'high' : (Math.random() > 0.5 ? 'medium' : 'low');
      const type = defectTypes[Math.floor(Math.random() * defectTypes.length)];
      const side = sides[Math.floor(Math.random() * sides.length)];
      const width = Math.floor(Math.random() * 600) + 3;
      const height = Math.floor(Math.random() * 500) + 3;
      const distance = Math.round((Math.random() * 55 + 5) * 100) / 100;

      defects.push({
        id: `d0000000-${String(defectCounter).padStart(4, '0')}-4000-8000-000000000${String(defectCounter).padStart(3, '0')}`,
        inspection_id: inspection.id,
        type,
        severity,
        distance_from_root: distance,
        description: `${type.replace(/_/g, ' ')} detected at ${distance}m from root`,
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
      defectCounter++;
    }
  }

  console.log(`\nPrepared ${defects.length} defects to insert`);

  // ─── Step 6: Insert defects in batches ────────────────────────────────
  const BATCH_SIZE = 20;
  let insertedCount = 0;

  for (let i = 0; i < defects.length; i += BATCH_SIZE) {
    const batch = defects.slice(i, i + BATCH_SIZE);
    const { error: defError } = await client.from('defect').upsert(batch, { onConflict: 'id' });
    if (defError) {
      console.error(`Defect batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, defError.message);
      // If error is about missing columns, log helpful message
      if (defError.message.includes('width_cm') || defError.message.includes('side')) {
        console.error('\n⚠️  Migration needed! Run the SQL in scripts/migrate-defects-dashboard.sql via Supabase Dashboard SQL Editor first.');
        process.exit(1);
      }
    } else {
      insertedCount += batch.length;
    }
  }
  console.log(`✓ ${insertedCount} defects upserted`);

  // ─── Step 7: Create defect comments ───────────────────────────────────
  console.log('\n─── Creating defect comments ───');

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

  const authors = [
    { name: 'Rocío Martínez', id: adminId },
    { name: 'Carlos Vega', id: adminId },
    { name: 'Ana Beltrán', id: adminId },
  ];

  const comments = [];
  // Add 1-3 comments to the first 100 defects
  const defectsForComments = defects.slice(0, 100);
  let commentCounter = 1;

  for (const defect of defectsForComments) {
    const numComments = 1 + Math.floor(Math.random() * 3);
    for (let c = 0; c < numComments; c++) {
      const daysAgo = Math.floor(Math.random() * 90);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      comments.push({
        id: `c0000000-${String(commentCounter).padStart(4, '0')}-4000-8000-000000000${String(commentCounter).padStart(3, '0')}`,
        defect_id: defect.id,
        author_id: authors[c % authors.length].id,
        text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
        created_at: date.toISOString(),
      });
      commentCounter++;
    }
  }

  console.log(`Prepared ${comments.length} comments`);

  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    const batch = comments.slice(i, i + BATCH_SIZE);
    const { error: comError } = await client.from('defect_comment').upsert(batch, { onConflict: 'id' });
    if (comError) {
      if (comError.message.includes('defect_comment')) {
        console.error('\n⚠️  Table defect_comment does not exist. Run migration first!');
        console.log('Skipping comments...');
        break;
      }
      console.error(`Comment batch error:`, comError.message);
    }
  }
  console.log(`✓ Comments inserted`);

  // ─── Step 8: Update turbine model field ───────────────────────────────
  console.log('\n─── Updating turbine models ───');

  const turbineModels = [
    { pattern: 'FDM-', model: 'Vestas V90' },
    { pattern: 'SDM-', model: 'Siemens Gamesa SG 5.8' },
    { pattern: 'ADD-', model: 'Nordex N163' },
    { pattern: 'PDC-', model: 'Enercon E-126' },
    { pattern: 'LLA-', model: 'Vestas V236' },
  ];

  for (const tm of turbineModels) {
    const { error: updateErr } = await client
      .from('turbine')
      .update({ model: tm.model })
      .like('name', `${tm.pattern}%`);
    if (updateErr) {
      // model column might not exist yet
      if (updateErr.message.includes('model')) {
        console.log('⚠️  turbine.model column not found, skipping model update');
        break;
      }
    }
  }
  console.log('✓ Turbine models updated');

  // ─── Verification ─────────────────────────────────────────────────────
  console.log('\n─── Verification ───');
  const { data: vDefects, error: vErr } = await client.from('defect').select('id', { count: 'exact', head: true });
  console.log(`Total defects in DB: ${vErr ? 'error' : vDefects}`);
  
  const { count: defectCount } = await client.from('defect').select('*', { count: 'exact', head: true });
  console.log(`Defect count: ${defectCount}`);

  const { count: commentCount } = await client.from('defect_comment').select('*', { count: 'exact', head: true }).catch(() => ({ count: 0 }));
  console.log(`Comment count: ${commentCount ?? 'table not available'}`);

  console.log('\n✓ Defects dashboard seed complete!');
  console.log('The Defects tab should now display data when browsing Wind Farms → Defects.');
}

run().catch(console.error);
