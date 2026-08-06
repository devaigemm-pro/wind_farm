/**
 * Seed data for ALL finalized inspections that are missing photos/defects.
 * 
 * Finds inspections with stage='finalized' that don't have inspection_photo records,
 * then generates:
 * - inspection_photo records (4 faces × 5 positions = 20 per blade)
 * - defect records linked to the inspection
 * - annotation records linked to photo IDs
 * 
 * IDEMPOTENT: Skips inspections that already have photos.
 * 
 * Usage:
 *   node scripts/seed-finalized-inspections.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const AUTH_EMAIL = 'admin@windfarm.dev';
const AUTH_PASSWORD = 'password123';

const FACES = ['leading_edge', 'trailing_edge', 'suction_side', 'pressure_side'];
const POSITIONS_PER_FACE = 5;

const DEFECT_TEMPLATES = [
  { type: 'le_erosion', severity: 3, description: 'Erosion moderada en borde de ataque', distance: 29.7, side: 'LE' },
  { type: 'le_erosion', severity: 4, description: 'Erosion severa en zona de punta', distance: 38.5, side: 'LE' },
  { type: 'le_erosion', severity: 3, description: 'Erosion leve zona media', distance: 33.6, side: 'LE' },
  { type: 'vortex', severity: 3, description: 'Paneles vortex faltantes', distance: 31.0, side: 'SS' },
  { type: 'vortex', severity: 3, description: 'Vortex generators ausentes', distance: 35.2, side: 'SS' },
  { type: 'paint_defect', severity: 3, description: 'Dano de pintura localizado', distance: 39.8, side: 'SS' },
  { type: 'crack', severity: 4, description: 'Grieta longitudinal en borde', distance: 41.4, side: 'LE' },
  { type: 'other', severity: 3, description: 'Add-on de proteccion faltante', distance: 28.9, side: 'LE' },
  { type: 'lightning_damage', severity: 4, description: 'Mancha de aceite hidraulico', distance: 42.7, side: 'SS' },
  { type: 'delamination', severity: 3, description: 'Delaminacion superficial detectada', distance: 25.3, side: 'PS' },
];

const ANNOTATION_TEMPLATES = [
  { type: 'LE EROSION', category: 3, note: 'Erosion moderada en borde de ataque', rootCause: 'Desgaste ambiental', nextStep: 'Aplicar recubrimiento' },
  { type: 'LE EROSION', category: 4, note: 'Erosion severa en zona de punta', rootCause: 'Exposicion prolongada', nextStep: 'Reparacion en campo' },
  { type: 'VORTEX (MISSING PANELS)', category: 3, note: 'Paneles vortex faltantes', rootCause: 'Adhesivo degradado', nextStep: 'Reemplazar paneles' },
  { type: 'PAINT DAMAGES', category: 3, note: 'Dano de pintura localizado', rootCause: 'Impacto', nextStep: 'Repintar zona' },
  { type: 'CRACK', category: 4, note: 'Grieta longitudinal', rootCause: 'Fatiga estructural', nextStep: 'Reparacion urgente' },
  { type: 'OTHER ADD-ONS MISSING', category: 3, note: 'Componente faltante', rootCause: 'Instalacion deficiente', nextStep: 'Reinstalar' },
  { type: 'BLADES WITH HYDRAULIC OIL', category: 4, note: 'Aceite hidraulico detectado', rootCause: 'Fuga sistema', nextStep: 'Limpiar y reparar fuga' },
];

async function main() {
  console.log('🌱 Seeding data for finalized inspections...\n');

  // Auth
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    process.exit(1);
  }
  console.log('  ✓ Authenticated\n');

  // Find all finalized inspections
  const { data: inspections, error: inspErr } = await supabase
    .from('inspection')
    .select('id, blade_id, campaign_id, inspector_id')
    .eq('stage', 'finalized')
    .order('created_at');

  if (inspErr) {
    console.error('Failed to fetch inspections:', inspErr.message);
    process.exit(1);
  }

  if (!inspections || inspections.length === 0) {
    console.log('  No finalized inspections found.');
    return;
  }

  console.log(`  Found ${inspections.length} finalized inspections\n`);

  let totalPhotos = 0;
  let totalDefects = 0;
  let totalAnnotations = 0;

  for (const insp of inspections) {
    // Check if photos already exist
    const { data: existingPhotos } = await supabase
      .from('inspection_photo')
      .select('id')
      .eq('campaign_id', insp.campaign_id)
      .eq('blade_id', insp.blade_id)
      .limit(1);

    if (existingPhotos && existingPhotos.length > 0) {
      console.log(`  ⏭  Inspection ${insp.id.slice(0, 8)}... already has photos, skipping`);
      continue;
    }

    // Need a campaign_id to store photos
    let campaignId = insp.campaign_id;
    if (!campaignId) {
      // Create an ad-hoc campaign for this inspection
      // First get wind_farm_id through blade → turbine
      const { data: blade } = await supabase
        .from('blade')
        .select('turbine:turbine_id(wind_farm_id)')
        .eq('id', insp.blade_id)
        .single();

      if (!blade || !blade.turbine) {
        console.log(`  ⚠  Inspection ${insp.id.slice(0, 8)}... no blade/turbine found, skipping`);
        continue;
      }

      const windFarmId = blade.turbine.wind_farm_id;
      const { data: newCamp, error: campErr } = await supabase
        .from('campaign')
        .insert({ wind_farm_id: windFarmId, name: `Auto-generated campaign`, status: 'completed' })
        .select('id')
        .single();

      if (campErr) {
        console.log(`  ⚠  Failed to create campaign: ${campErr.message}`);
        continue;
      }
      campaignId = newCamp.id;

      // Link inspection to campaign
      await supabase.from('inspection').update({ campaign_id: campaignId }).eq('id', insp.id);
    }

    // Insert photos
    const photoRows = [];
    let order = 1;
    for (const face of FACES) {
      for (let pos = 1; pos <= POSITIONS_PER_FACE; pos++) {
        const radialPosition = pos / POSITIONS_PER_FACE;
        photoRows.push({
          campaign_id: campaignId,
          blade_id: insp.blade_id,
          face,
          radial_position: radialPosition,
          flight_plan_order: order,
          storage_path: `${campaignId}/${insp.blade_id}/${face}/${String(order).padStart(2, '0')}_photo.jpg`,
          filename: `${String(order).padStart(2, '0')}_photo.jpg`,
          analyzed: true,
          metadata: { seeded: true },
        });
        order++;
      }
    }

    const { data: insertedPhotos, error: photoErr } = await supabase
      .from('inspection_photo')
      .insert(photoRows)
      .select('id, face, radial_position');

    if (photoErr) {
      console.log(`  ⚠  Photos failed for ${insp.id.slice(0, 8)}...: ${photoErr.message}`);
      continue;
    }

    totalPhotos += photoRows.length;

    // Insert defects (3-6 per inspection)
    const numDefects = 3 + Math.floor(Math.random() * 4);
    const defectRows = [];
    for (let i = 0; i < numDefects; i++) {
      const template = DEFECT_TEMPLATES[i % DEFECT_TEMPLATES.length];
      defectRows.push({
        inspection_id: insp.id,
        type: template.type,
        severity: template.severity,
        distance_from_root: template.distance + (Math.random() * 3 - 1.5),
        description: template.description,
        side: template.side,
        width_cm: Math.floor(5 + Math.random() * 20),
        height_cm: Math.floor(100 + Math.random() * 400),
      });
    }

    const { error: defErr } = await supabase.from('defect').insert(defectRows);
    if (defErr) {
      console.log(`  ⚠  Defects failed for ${insp.id.slice(0, 8)}...: ${defErr.message}`);
    } else {
      totalDefects += defectRows.length;
    }

    // Insert annotations on some photos
    const numAnnotations = 3 + Math.floor(Math.random() * 3);
    const photos = insertedPhotos || [];
    const annotationRows = [];
    for (let i = 0; i < Math.min(numAnnotations, photos.length); i++) {
      const photo = photos[Math.floor(Math.random() * photos.length)];
      const template = ANNOTATION_TEMPLATES[i % ANNOTATION_TEMPLATES.length];
      annotationRows.push({
        inspection_id: insp.id,
        thumbnail_id: photo.id,
        x: 15 + Math.random() * 40,
        y: 10 + Math.random() * 50,
        w: 10 + Math.random() * 30,
        h: 8 + Math.random() * 25,
        angle: 0,
        type: template.type,
        category: template.category,
        note: template.note,
        root_cause: template.rootCause,
        next_step: template.nextStep,
      });
    }

    const { error: annErr } = await supabase.from('annotation').insert(annotationRows);
    if (annErr) {
      console.log(`  ⚠  Annotations failed for ${insp.id.slice(0, 8)}...: ${annErr.message}`);
    } else {
      totalAnnotations += annotationRows.length;
    }

    // Update photos_count on inspection
    await supabase.from('inspection').update({ photos_count: photoRows.length }).eq('id', insp.id);

    console.log(`  ✓ Inspection ${insp.id.slice(0, 8)}... → ${photoRows.length} photos, ${defectRows.length} defects, ${annotationRows.length} annotations`);
  }

  console.log(`\n✅ Seed complete!`);
  console.log(`   Photos: ${totalPhotos}`);
  console.log(`   Defects: ${totalDefects}`);
  console.log(`   Annotations: ${totalAnnotations}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
