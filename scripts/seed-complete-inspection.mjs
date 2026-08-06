/**
 * Seed script: Creates a complete inspection workflow with real data.
 * 
 * This script:
 * 1. Finds an existing turbine (first available)
 * 2. Finds/creates a campaign for that wind farm
 * 3. Creates inspections for all 3 blades (if not existing)
 * 4. Inserts inspection_photo records (4 faces × 5 positions = 20 per blade, 60 total)
 * 5. Inserts annotation records for some photos (simulating found defects)
 * 6. Marks the inspections as finalized
 * 
 * IDEMPOTENT: Can be run multiple times without duplicating data.
 * 
 * Usage:
 *   node scripts/seed-complete-inspection.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Auth credentials (inspector user)
const AUTH_EMAIL = process.env.SEED_EMAIL || 'admin@windfarm.dev';
const AUTH_PASSWORD = process.env.SEED_PASSWORD || 'password123';

// ─── Configuration ───────────────────────────────────────────────────────────

const FACES = ['leading_edge', 'trailing_edge', 'suction_side', 'pressure_side'];
const POSITIONS_PER_FACE = 5; // 5 radial positions per face
const CAMPAIGN_NAME = 'Seed Campaign - Complete Inspection';

const DEFECT_TEMPLATES = [
  { type: 'LE EROSION', category: 3, note: 'Erosion moderada en borde de ataque', rootCause: 'Desgaste ambiental', nextStep: 'Aplicar recubrimiento' },
  { type: 'LE EROSION', category: 4, note: 'Erosion severa en zona de punta', rootCause: 'Exposicion prolongada', nextStep: 'Reparacion en campo' },
  { type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Paneles vortex faltantes', rootCause: 'Adhesivo degradado', nextStep: 'Reemplazar paneles' },
  { type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Vortex generators ausentes', rootCause: 'Vibracion operativa', nextStep: 'Reinstalar paneles' },
  { type: 'PAINT DAMAGES', category: 3, note: 'Dano de pintura localizado', rootCause: 'Impacto', nextStep: 'Repintar zona' },
  { type: 'BLADES WITH HYDRAULIC OIL', category: 4, note: 'Mancha de aceite hidraulico', rootCause: 'Fuga sistema hidraulico', nextStep: 'Limpiar y reparar fuga' },
  { type: 'CRACK', category: 4, note: 'Grieta longitudinal en borde', rootCause: 'Fatiga estructural', nextStep: 'Reparacion urgente' },
  { type: 'OTHER ADD-ONS MISSING', category: 3, note: 'Add-on de proteccion faltante', rootCause: 'Instalacion deficiente', nextStep: 'Reinstalar componente' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding complete inspection data...\n');

  // Authenticate first
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD,
  });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    console.error('Set SEED_EMAIL and SEED_PASSWORD env vars or ensure default credentials work.');
    process.exit(1);
  }
  console.log(`  Authenticated as ${AUTH_EMAIL}`);

  // 1. Find a turbine with blades
  const { data: turbines, error: turbErr } = await supabase
    .from('turbine')
    .select('id, name, wind_farm_id')
    .order('name')
    .limit(1);

  if (turbErr || !turbines || turbines.length === 0) {
    console.error('No turbines found in database. Seed wind farms first.');
    process.exit(1);
  }

  const turbine = turbines[0];
  console.log(`  Turbine: ${turbine.name} (${turbine.id})`);

  // Get blades for this turbine
  const { data: blades, error: bladeErr } = await supabase
    .from('blade')
    .select('id, position, serial_number')
    .eq('turbine_id', turbine.id)
    .order('position');

  if (bladeErr || !blades || blades.length === 0) {
    console.error('No blades found for turbine. Seed blades first.');
    process.exit(1);
  }

  console.log(`  Blades: ${blades.map(b => `${b.position}(${b.serial_number || 'N/A'})`).join(', ')}`);

  // 2. Find or create campaign
  const { data: existingCampaigns } = await supabase
    .from('campaign')
    .select('id')
    .eq('wind_farm_id', turbine.wind_farm_id)
    .eq('name', CAMPAIGN_NAME)
    .limit(1);

  let campaignId;
  if (existingCampaigns && existingCampaigns.length > 0) {
    campaignId = existingCampaigns[0].id;
    console.log(`  Campaign already exists: ${campaignId}`);
  } else {
    const { data: newCampaign, error: campErr } = await supabase
      .from('campaign')
      .insert({
        wind_farm_id: turbine.wind_farm_id,
        name: CAMPAIGN_NAME,
      })
      .select('id')
      .single();

    if (campErr) {
      console.error('Failed to create campaign:', campErr.message);
      process.exit(1);
    }
    campaignId = newCampaign.id;
    console.log(`  Campaign created: ${campaignId}`);
  }

  // 3. Get an inspector (first profile)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);

  const inspectorId = profiles?.[0]?.id;
  if (!inspectorId) {
    console.error('No profiles found. Create a user first.');
    process.exit(1);
  }

  // 4. Create inspections for each blade (idempotent)
  const inspectionIds = [];
  for (const blade of blades) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('inspection')
      .select('id')
      .eq('blade_id', blade.id)
      .eq('campaign_id', campaignId)
      .limit(1);

    if (existing && existing.length > 0) {
      inspectionIds.push(existing[0].id);
      console.log(`  Inspection for blade ${blade.position} already exists: ${existing[0].id}`);
      continue;
    }

    const { data: newInsp, error: inspErr } = await supabase
      .from('inspection')
      .insert({
        blade_id: blade.id,
        campaign_id: campaignId,
        inspector_id: inspectorId,
        scheduled_date: new Date().toISOString().split('T')[0],
        completed_at: new Date().toISOString(),
        stage: 'finalized',
        status: 'completed',
        photos_count: FACES.length * POSITIONS_PER_FACE,
      })
      .select('id')
      .single();

    if (inspErr) {
      console.error(`Failed to create inspection for blade ${blade.position}:`, inspErr.message);
      continue;
    }
    inspectionIds.push(newInsp.id);
    console.log(`  Inspection created for blade ${blade.position}: ${newInsp.id}`);
  }

  // 5. Insert inspection_photo records for each blade
  console.log('\n  Inserting inspection photos...');
  let totalPhotosInserted = 0;

  for (const blade of blades) {
    // Check if photos already exist for this blade + campaign
    const { data: existingPhotos } = await supabase
      .from('inspection_photo')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('blade_id', blade.id)
      .limit(1);

    if (existingPhotos && existingPhotos.length > 0) {
      console.log(`    Photos for blade ${blade.position} already exist, skipping.`);
      continue;
    }

    const photoRows = [];
    let order = 1;
    for (const face of FACES) {
      for (let pos = 1; pos <= POSITIONS_PER_FACE; pos++) {
        const radialPosition = pos / POSITIONS_PER_FACE; // 0.2, 0.4, 0.6, 0.8, 1.0
        const storagePath = `${campaignId}/${blade.id}/${face}/${String(order).padStart(2, '0')}_photo.jpg`;
        photoRows.push({
          campaign_id: campaignId,
          blade_id: blade.id,
          face,
          radial_position: radialPosition,
          flight_plan_order: order,
          storage_path: storagePath,
          filename: `${String(order).padStart(2, '0')}_photo.jpg`,
          metadata: { seeded: true },
        });
        order++;
      }
    }

    const { error: photoErr } = await supabase
      .from('inspection_photo')
      .insert(photoRows);

    if (photoErr) {
      console.error(`    Failed to insert photos for blade ${blade.position}:`, photoErr.message);
    } else {
      totalPhotosInserted += photoRows.length;
      console.log(`    Blade ${blade.position}: ${photoRows.length} photos inserted`);
    }
  }

  console.log(`  Total photos inserted: ${totalPhotosInserted}`);

  // 6. Insert annotations for some photos (simulate defects found)
  console.log('\n  Inserting annotations...');

  // Get the photos we just inserted to use their IDs
  const { data: allPhotos } = await supabase
    .from('inspection_photo')
    .select('id, blade_id, face, radial_position')
    .eq('campaign_id', campaignId)
    .order('flight_plan_order');

  if (!allPhotos || allPhotos.length === 0) {
    console.log('  No photos found to annotate.');
  } else {
    // Group photos by blade
    const photosByBlade = {};
    for (const photo of allPhotos) {
      if (!photosByBlade[photo.blade_id]) photosByBlade[photo.blade_id] = [];
      photosByBlade[photo.blade_id].push(photo);
    }

    let annotationCount = 0;
    let defectTemplateIdx = 0;

    for (const blade of blades) {
      const bladePhotos = photosByBlade[blade.id] || [];
      const inspectionId = inspectionIds[blades.indexOf(blade)];
      if (!inspectionId || bladePhotos.length === 0) continue;

      // Check if annotations already exist for this inspection
      const { data: existingAnns } = await supabase
        .from('annotation')
        .select('id')
        .eq('inspection_id', inspectionId)
        .limit(1);

      if (existingAnns && existingAnns.length > 0) {
        console.log(`    Annotations for blade ${blade.position} already exist, skipping.`);
        continue;
      }

      // Add 3-5 annotations per blade on different photos
      const numAnnotations = 3 + Math.floor(Math.random() * 3);
      const selectedPhotoIndices = new Set();
      while (selectedPhotoIndices.size < Math.min(numAnnotations, bladePhotos.length)) {
        selectedPhotoIndices.add(Math.floor(Math.random() * bladePhotos.length));
      }

      const annotationRows = [];
      for (const idx of selectedPhotoIndices) {
        const photo = bladePhotos[idx];
        const template = DEFECT_TEMPLATES[defectTemplateIdx % DEFECT_TEMPLATES.length];
        defectTemplateIdx++;

        annotationRows.push({
          inspection_id: inspectionId,
          thumbnail_id: photo.id,
          x: 20 + Math.random() * 30,
          y: 15 + Math.random() * 40,
          w: 10 + Math.random() * 25,
          h: 8 + Math.random() * 20,
          angle: 0,
          type: template.type,
          category: template.category,
          note: template.note,
        });
      }

      const { error: annErr } = await supabase
        .from('annotation')
        .insert(annotationRows);

      if (annErr) {
        console.error(`    Failed to insert annotations for blade ${blade.position}:`, annErr.message);
      } else {
        annotationCount += annotationRows.length;
        console.log(`    Blade ${blade.position}: ${annotationRows.length} annotations inserted`);
      }
    }

    console.log(`  Total annotations inserted: ${annotationCount}`);
  }

  // 7. Ensure inspections are marked as finalized
  for (const inspId of inspectionIds) {
    await supabase
      .from('inspection')
      .update({ stage: 'finalized', status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', inspId);
  }

  console.log('\n✅ Seed complete! Inspection workflow data is ready.');
  console.log(`   Campaign: ${campaignId}`);
  console.log(`   Inspections: ${inspectionIds.join(', ')}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
