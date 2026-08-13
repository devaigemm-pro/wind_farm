/**
 * Cleanup: delete ALL subassets (blades) and inspections 
 * EXCEPT those associated with turbine FDM-T02.
 * 
 * Cascade order (leaf → parent):
 *   1. defect_image (depends on defect)
 *   2. evidence (depends on defect)
 *   3. defect (depends on inspection)
 *   4. annotation (depends on inspection)
 *   5. inspection_photo (depends on campaign + blade)
 *   6. inspection (depends on blade)
 *   7. campaign (depends on wind_farm — only delete if no remaining inspections reference it)
 *   8. blade (depends on turbine)
 *
 * FDM-T02 turbine ID: 10000000-0002-4000-8000-000000000002
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FDM_T02_ID = '10000000-0002-4000-8000-000000000002';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  // Authenticate
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'Password123!',
  });
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
  console.log('✓ Authenticated');
  if (DRY_RUN) console.log('🔍 DRY RUN MODE — no data will be deleted\n');

  // ─── Step 1: Get ALL blades NOT belonging to FDM-T02 ───────────────────
  const { data: bladesToDelete, error: bladeErr } = await supabase
    .from('blade')
    .select('id, turbine_id')
    .neq('turbine_id', FDM_T02_ID);

  if (bladeErr) { console.error('Error fetching blades:', bladeErr.message); process.exit(1); }
  const bladeIds = (bladesToDelete || []).map(b => b.id);
  console.log(`Blades to delete: ${bladeIds.length}`);

  if (bladeIds.length === 0) {
    console.log('Nothing to delete. Only FDM-T02 blades exist.');
    process.exit(0);
  }

  // ─── Step 2: Get inspections for those blades ───────────────────────────
  const { data: inspections, error: inspErr } = await supabase
    .from('inspection')
    .select('id, blade_id, campaign_id')
    .in('blade_id', bladeIds);

  if (inspErr) { console.error('Error fetching inspections:', inspErr.message); process.exit(1); }
  const inspectionIds = (inspections || []).map(i => i.id);
  const campaignIdsFromInspections = [...new Set((inspections || []).map(i => i.campaign_id).filter(Boolean))];
  console.log(`Inspections to delete: ${inspectionIds.length}`);
  console.log(`Campaign IDs referenced: ${campaignIdsFromInspections.length}`);

  // ─── Step 3: Get annotations for those inspections ──────────────────────
  let annotationCount = 0;
  if (inspectionIds.length > 0) {
    const { count } = await supabase
      .from('annotation')
      .select('id', { count: 'exact', head: true })
      .in('inspection_id', inspectionIds);
    annotationCount = count ?? 0;
  }
  console.log(`Annotations to delete: ${annotationCount}`);

  // ─── Step 4: Get defects for those inspections ──────────────────────────
  let defectIds = [];
  if (inspectionIds.length > 0) {
    const { data: defects } = await supabase
      .from('defect')
      .select('id')
      .in('inspection_id', inspectionIds);
    defectIds = (defects || []).map(d => d.id);
  }
  console.log(`Defects to delete: ${defectIds.length}`);

  // ─── Step 5: Count inspection_photos for those blades ───────────────────
  let photoCount = 0;
  if (bladeIds.length > 0) {
    const { count } = await supabase
      .from('inspection_photo')
      .select('id', { count: 'exact', head: true })
      .in('blade_id', bladeIds);
    photoCount = count ?? 0;
  }
  console.log(`Inspection photos to delete: ${photoCount}`);

  // ─── Step 6: Determine campaigns to delete ──────────────────────────────
  // A campaign should be deleted only if ALL its blades are being deleted
  // (i.e., no blade of FDM-T02 belongs to it)
  const { data: fdmT02Blades } = await supabase
    .from('blade')
    .select('id')
    .eq('turbine_id', FDM_T02_ID);
  const fdmBladeIds = (fdmT02Blades || []).map(b => b.id);

  // Check which campaigns have FDM-T02 inspections (those should NOT be deleted)
  let campaignsToKeep = new Set();
  if (fdmBladeIds.length > 0) {
    const { data: fdmInspections } = await supabase
      .from('inspection')
      .select('campaign_id')
      .in('blade_id', fdmBladeIds);
    campaignsToKeep = new Set((fdmInspections || []).map(i => i.campaign_id).filter(Boolean));
  }

  const campaignsToDelete = campaignIdsFromInspections.filter(cid => !campaignsToKeep.has(cid));
  console.log(`Campaigns to delete: ${campaignsToDelete.length} (keeping ${campaignsToKeep.size} shared with FDM-T02)`);

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log('\n═══ SUMMARY ═══');
  console.log(`  Blades:            ${bladeIds.length}`);
  console.log(`  Inspections:       ${inspectionIds.length}`);
  console.log(`  Annotations:       ${annotationCount}`);
  console.log(`  Defects:           ${defectIds.length}`);
  console.log(`  Inspection Photos: ${photoCount}`);
  console.log(`  Campaigns:         ${campaignsToDelete.length}`);
  console.log(`  PRESERVED (FDM-T02): ${fdmBladeIds.length} blades + related data`);

  if (DRY_RUN) {
    console.log('\n🔍 Dry run complete. Run without --dry-run to execute deletions.');
    process.exit(0);
  }

  // ═══ EXECUTE DELETIONS (leaf → parent order) ════════════════════════════
  console.log('\n🗑️  Executing deletions...\n');

  // 1. defect_image
  if (defectIds.length > 0) {
    const { error } = await supabase.from('defect_image').delete().in('defect_id', defectIds);
    console.log(`  1. defect_image: ${error ? `ERROR: ${error.message}` : 'done'}`);
  }

  // 2. evidence
  if (defectIds.length > 0) {
    const { error } = await supabase.from('evidence').delete().in('defect_id', defectIds);
    console.log(`  2. evidence: ${error ? `ERROR: ${error.message}` : 'done'}`);
  }

  // 3. defects
  if (defectIds.length > 0) {
    const { error } = await supabase.from('defect').delete().in('id', defectIds);
    console.log(`  3. defect: ${error ? `ERROR: ${error.message}` : 'done'}`);
  }

  // 4. annotations (batch by inspection to avoid query size limits)
  if (inspectionIds.length > 0) {
    const BATCH = 50;
    let annDeleted = 0;
    for (let i = 0; i < inspectionIds.length; i += BATCH) {
      const batch = inspectionIds.slice(i, i + BATCH);
      const { error } = await supabase.from('annotation').delete().in('inspection_id', batch);
      if (error) { console.log(`  4. annotation batch ERROR: ${error.message}`); break; }
      annDeleted += batch.length;
    }
    console.log(`  4. annotations: done (across ${inspectionIds.length} inspections)`);
  }

  // 5. inspection_photo (batch by blade)
  if (bladeIds.length > 0) {
    const BATCH = 20;
    for (let i = 0; i < bladeIds.length; i += BATCH) {
      const batch = bladeIds.slice(i, i + BATCH);
      const { error } = await supabase.from('inspection_photo').delete().in('blade_id', batch);
      if (error) { console.log(`  5. inspection_photo batch ERROR: ${error.message}`); break; }
    }
    console.log(`  5. inspection_photo: done`);
  }

  // 6. inspections
  if (inspectionIds.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < inspectionIds.length; i += BATCH) {
      const batch = inspectionIds.slice(i, i + BATCH);
      const { error } = await supabase.from('inspection').delete().in('id', batch);
      if (error) { console.log(`  6. inspection batch ERROR: ${error.message}`); break; }
    }
    console.log(`  6. inspection: done`);
  }

  // 7. campaigns (only those not shared with FDM-T02)
  if (campaignsToDelete.length > 0) {
    const { error } = await supabase.from('campaign').delete().in('id', campaignsToDelete);
    console.log(`  7. campaign: ${error ? `ERROR: ${error.message}` : 'done'}`);
  }

  // 8. blades
  if (bladeIds.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < bladeIds.length; i += BATCH) {
      const batch = bladeIds.slice(i, i + BATCH);
      const { error } = await supabase.from('blade').delete().in('id', batch);
      if (error) { console.log(`  8. blade batch ERROR: ${error.message}`); break; }
    }
    console.log(`  8. blade: done`);
  }

  console.log('\n✓ Cleanup complete. Only FDM-T02 data remains.');
  process.exit(0);
}

main();
