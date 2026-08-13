/**
 * Import Skyvisor inspection photos for FDM-T03.
 * Same pattern as FDM-T02:
 * - storage_path starts with inspection-imports/
 * - Downloads originals + thumbnails from Skyvisor signed URLs
 * - Uploads both to Supabase Storage bucket 'asset-documents'
 * - Creates inspection_photo records with correct blade/face from Skyvisor metadata
 * - Inserts DB records in batches (resume-safe)
 * 
 * Usage: node scripts/import-skyvisor-t03.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';

const CAMPAIGN_ID = '54e41928-afdf-43cf-984c-acdaf8e1b746';
const INSPECTION_ID = '07a234d2-2dcf-4305-acbf-ee688104406f';
const BUCKET = 'asset-documents';
const CONCURRENCY = 3;

const BLADE_MAP = {
  'A': '5c0d5a70-c246-4511-84c7-2dff1dcf6dfb',
  'B': 'e36d9df9-8997-4e73-9954-37ffe5d9036d',
  'C': 'cd367bb2-4596-4197-940f-cd8f166c2f24',
};
const FACE_MAP = {
  'SS': 'suction_side',
  'PS': 'pressure_side',
  'LE': 'leading_edge',
  'TE': 'trailing_edge',
  '': 'suction_side',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('═══ Skyvisor Import → FDM-T03 ═══\n');

  await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  console.log('✓ Authenticated');

  // Load data
  const originalUrls = JSON.parse(readFileSync('/tmp/skyvisor-original-urls.json', 'utf-8'));
  const thumbUrls = JSON.parse(readFileSync('/tmp/all-skyvisor-urls.json', 'utf-8'));
  const metadata = JSON.parse(readFileSync('/tmp/skyvisor-photos-meta.json', 'utf-8'));
  console.log(`✓ Loaded ${metadata.length} photos\n`);

  // Check what's already imported
  const { data: existing } = await supabase
    .from('inspection_photo')
    .select('filename')
    .eq('campaign_id', CAMPAIGN_ID);
  const done = new Set((existing || []).map(r => r.filename));
  console.log(`Already imported: ${done.size}, remaining: ${metadata.length - done.size}\n`);

  // Build photo list
  const orderCounters = {};
  const photos = metadata.map((meta, idx) => {
    const bladeId = BLADE_MAP[meta.blade] || BLADE_MAP['A'];
    const face = FACE_MAP[meta.side] || 'suction_side';
    const key = `${bladeId}/${face}`;
    orderCounters[key] = (orderCounters[key] || 0) + 1;
    const order = orderCounters[key];
    const storagePath = `inspection-imports/${CAMPAIGN_ID}/${bladeId}/${face}/${order}_${meta.photoId}`;
    const thumbPath = `inspection-imports/${CAMPAIGN_ID}/${bladeId}/${face}/thumb_${order}_${meta.photoId}`;
    return {
      filename: meta.photoId,
      bladeId, face, order, storagePath, thumbPath,
      thumbUrl: thumbUrls[idx],
      originalUrl: originalUrls[idx],
      hubDistance: meta.hubDistance || 0,
      flightOrder: idx + 1,
    };
  }).filter(p => !done.has(p.filename));

  let uploaded = 0, failed = 0;

  for (let i = 0; i < photos.length; i += CONCURRENCY) {
    const batch = photos.slice(i, Math.min(i + CONCURRENCY, photos.length));
    const records = [];

    await Promise.all(batch.map(async (photo) => {
      try {
        // Download thumb and original in parallel
        const [thumbResp, origResp] = await Promise.all([
          fetch(photo.thumbUrl),
          fetch(photo.originalUrl),
        ]);
        if (!thumbResp.ok || !origResp.ok) { failed++; return; }

        const [thumbBuf, origBuf] = await Promise.all([
          thumbResp.arrayBuffer().then(b => Buffer.from(b)),
          origResp.arrayBuffer().then(b => Buffer.from(b)),
        ]);

        // Upload both to Storage
        const [thumbUp, origUp] = await Promise.all([
          supabase.storage.from(BUCKET).upload(photo.thumbPath, thumbBuf, { contentType: 'image/jpeg', upsert: true }),
          supabase.storage.from(BUCKET).upload(photo.storagePath, origBuf, { contentType: 'image/jpeg', upsert: true }),
        ]);

        if (origUp.error) { failed++; return; }

        records.push({
          campaign_id: CAMPAIGN_ID,
          blade_id: photo.bladeId,
          face: photo.face,
          radial_position: photo.hubDistance > 0 ? parseFloat(Math.min(photo.hubDistance / 50, 1.0).toFixed(3)) : parseFloat(Math.min(photo.order / 40, 1.0).toFixed(3)),
          flight_plan_order: photo.flightOrder,
          storage_path: photo.storagePath,
          filename: photo.filename,
          metadata: {
            source: 'skyvisor',
            original_inspection: 'BKfxiIihRgG6cy6vzAij',
            external_thumb_url: photo.thumbUrl,
            external_full_url: photo.originalUrl,
          },
        });
        uploaded++;
      } catch (e) { failed++; }
    }));

    // Insert DB records immediately
    if (records.length > 0) {
      const { error: dbErr } = await supabase.from('inspection_photo').insert(records);
      if (dbErr) console.warn(`  ⚠ DB: ${dbErr.message}`);
    }

    const progress = Math.min(i + CONCURRENCY, photos.length);
    if (progress % 9 === 0 || progress === photos.length) {
      process.stdout.write(`  ${progress}/${photos.length} (${uploaded} ok, ${failed} fail)\n`);
    }
  }

  // Update inspection stage
  await supabase.from('inspection').update({ stage: 'inspect' }).eq('id', INSPECTION_ID);

  console.log(`\n═══ Done: ${uploaded} uploaded, ${failed} failed ═══`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
