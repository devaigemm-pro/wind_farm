/**
 * Import photos to FDM-T04 (1 per face) and FDM-T05 (2 per face).
 * Uses same Skyvisor source photos from BKfxiIihRgG6cy6vzAij.
 * Same method as FDM-T02/T03: download from Skyvisor, upload to Storage, create DB records.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';
const BUCKET = 'asset-documents';
const CAMPAIGN_ID = 'a7e64bcc-aca4-469b-be0a-e33b30ff9678';

const TURBINES = [
  {
    name: 'FDM-T04',
    inspectionId: '5bde6778-31a2-41d8-bd4a-c51d4f579a84',
    blades: [
      '515d7bdb-3f2b-45cb-ad6a-0a154ef9eb63',
      '435a7613-2b57-4a94-86d4-0e4a4fb2a297',
      'f1d34ea9-532e-42fc-8659-441822f849f0',
    ],
    photosPerFace: 1,
  },
  {
    name: 'FDM-T05',
    inspectionId: '49500147-69a0-4cc2-9849-908c29b52071',
    blades: [
      '54d245e6-697b-4911-8008-80b7188d4fc1',
      'e602adbf-01f3-4263-b10b-717625d7fbad',
      '18e95668-01b9-42f0-ad42-9327dfcb2ac0',
    ],
    photosPerFace: 2,
  },
];

const FACES = ['suction_side', 'pressure_side', 'leading_edge', 'trailing_edge'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('═══ Import Photos → FDM-T04 & FDM-T05 ═══\n');

  await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  console.log('✓ Authenticated');

  // Load Skyvisor URLs (reuse from T03 extraction)
  const originalUrls = JSON.parse(readFileSync('/tmp/skyvisor-original-urls.json', 'utf-8'));
  const thumbUrls = JSON.parse(readFileSync('/tmp/all-skyvisor-urls.json', 'utf-8'));
  console.log(`✓ Loaded ${originalUrls.length} source URLs\n`);

  let urlIndex = 0; // Counter to pick different photos for each turbine/blade/face
  let totalUploaded = 0;

  for (const turbine of TURBINES) {
    console.log(`\n─── ${turbine.name} (${turbine.photosPerFace} per face) ───`);
    let flightOrder = 0;

    for (const bladeId of turbine.blades) {
      for (const face of FACES) {
        for (let p = 0; p < turbine.photosPerFace; p++) {
          const idx = urlIndex % originalUrls.length;
          urlIndex++;
          flightOrder++;

          const filename = `DJI_${String(urlIndex).padStart(4, '0')}.JPG`;
          const storagePath = `inspection-imports/${CAMPAIGN_ID}/${bladeId}/${face}/${p + 1}_${filename}`;
          const thumbPath = `inspection-imports/${CAMPAIGN_ID}/${bladeId}/${face}/thumb_${p + 1}_${filename}`;

          try {
            // Download thumb + original
            const [thumbResp, origResp] = await Promise.all([
              fetch(thumbUrls[idx]),
              fetch(originalUrls[idx]),
            ]);
            if (!thumbResp.ok || !origResp.ok) { console.warn(`  ⚠ Download failed for ${filename}`); continue; }

            const [thumbBuf, origBuf] = await Promise.all([
              thumbResp.arrayBuffer().then(b => Buffer.from(b)),
              origResp.arrayBuffer().then(b => Buffer.from(b)),
            ]);

            // Upload to Storage
            await Promise.all([
              supabase.storage.from(BUCKET).upload(thumbPath, thumbBuf, { contentType: 'image/jpeg', upsert: true }),
              supabase.storage.from(BUCKET).upload(storagePath, origBuf, { contentType: 'image/jpeg', upsert: true }),
            ]);

            // Insert DB record
            const { error } = await supabase.from('inspection_photo').insert({
              campaign_id: CAMPAIGN_ID,
              blade_id: bladeId,
              face,
              radial_position: parseFloat(((p + 1) / (turbine.photosPerFace + 1)).toFixed(3)),
              flight_plan_order: flightOrder,
              storage_path: storagePath,
              filename,
              metadata: {
                source: 'skyvisor',
                original_inspection: 'BKfxiIihRgG6cy6vzAij',
                external_thumb_url: thumbUrls[idx],
                external_full_url: originalUrls[idx],
              },
            });

            if (error) console.warn(`  ⚠ DB: ${error.message}`);
            else totalUploaded++;
          } catch (e) {
            console.warn(`  ⚠ ${filename}: ${e.message}`);
          }
        }
      }
    }

    // Update inspection stage
    await supabase.from('inspection').update({ stage: 'inspect' }).eq('id', turbine.inspectionId);
    console.log(`  ✓ ${turbine.name} done, stage → inspect`);
  }

  console.log(`\n═══ Done: ${totalUploaded} photos uploaded ═══`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
