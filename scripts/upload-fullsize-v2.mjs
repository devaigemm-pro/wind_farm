/**
 * Upload full-size photos from a JSON file with fresh Skyvisor URLs.
 * Reads /tmp/fullsize-urls.json and uploads to Supabase storage.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';
const CAMPAIGN_ID = '1118f958-4b94-452c-a215-63c37fd70a44';
const BUCKET = 'asset-documents';
const BATCH_SIZE = 2;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('═══ Upload Full-Size Photos ═══\n');

  await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  console.log('✓ Authenticated\n');

  // Load URLs from JSON (output from browser eval)
  const raw = readFileSync('/tmp/fullsize-urls.json', 'utf-8');
  const fullUrls = JSON.parse(JSON.parse(raw)); // double-parse because eval wraps in quotes
  console.log(`Loaded ${fullUrls.length} full-size URLs\n`);

  // Build filename → URL map
  const urlMap = {};
  for (const item of fullUrls) {
    urlMap[item.filename] = item.url;
  }

  // Get photo records
  const { data: photos } = await supabase
    .from('inspection_photo')
    .select('id, filename, storage_path')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('flight_plan_order');

  console.log(`${photos.length} photos to upload\n`);

  let uploaded = 0, failed = 0;

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (photo) => {
      const url = urlMap[photo.filename];
      if (!url) { failed++; return; }
      try {
        const resp = await fetch(url);
        if (!resp.ok) { failed++; return; }
        const buf = Buffer.from(await resp.arrayBuffer());
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(photo.storage_path, buf, { contentType: 'image/jpeg', upsert: true });
        if (error) { failed++; return; }
        uploaded++;
      } catch { failed++; }
    }));
    if (i % 20 === 0) console.log(`  ${i+BATCH_SIZE}/${photos.length} (${uploaded} ok, ${failed} fail)`);
  }

  console.log(`\n═══ Done: ${uploaded} uploaded, ${failed} failed ═══`);
}

main().catch(e => { console.error(e); process.exit(1); });
