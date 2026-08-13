/**
 * Re-upload full-size photos from Skyvisor (replacing thumbnails).
 * Extracts fresh signed URLs from the active browser session.
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';
const CAMPAIGN_ID = '1118f958-4b94-452c-a215-63c37fd70a44';
const BUCKET = 'asset-documents';
const BATCH_SIZE = 2; // Full-size files are 2-5MB, use small batches

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function extractFullUrls() {
  console.log('Extracting fresh full-size URLs from Skyvisor browser...');
  const script = `(function(){
    const allImgs = document.querySelectorAll('img[src*="googleapis"]');
    const data = Array.from(allImgs).map(img => {
      const fullUrl = img.src.replace('/thumb_', '/');
      const match = fullUrl.match(/rawPhotos\\/(.+?)\\?/);
      const filename = match ? match[1] : 'unknown.JPG';
      return { filename, fullUrl };
    });
    return JSON.stringify(data);
  })()`;

  const result = execSync(
    `echo '${script.replace(/'/g, "'\\''")}' | agent-browser --session skyvisor eval --stdin`,
    { encoding: 'utf-8', timeout: 30000 }
  );
  return JSON.parse(JSON.parse(result.trim()));
}

async function main() {
  console.log('═══ Upload Full-Size Photos from Skyvisor ═══\n');

  await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  console.log('✓ Authenticated\n');

  // Extract fresh URLs from browser
  const freshUrls = extractFullUrls();
  console.log(`✓ Got ${freshUrls.length} fresh full-size URLs\n`);

  // Build filename → fullUrl map
  const urlMap = {};
  for (const item of freshUrls) {
    urlMap[item.filename] = item.fullUrl;
  }

  // Get all photo records
  const { data: photos, error } = await supabase
    .from('inspection_photo')
    .select('id, filename, storage_path')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('flight_plan_order');

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  console.log(`Found ${photos.length} photo records\n`);

  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (photo) => {
      const fullUrl = urlMap[photo.filename];
      if (!fullUrl) { skipped++; return; }

      try {
        const resp = await fetch(fullUrl);
        if (!resp.ok) { failed++; return; }

        const buffer = Buffer.from(await resp.arrayBuffer());

        // Upload to same path (upsert=true replaces the thumbnail)
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(photo.storage_path, buffer, { contentType: 'image/jpeg', upsert: true });

        if (upErr) { failed++; return; }
        uploaded++;
      } catch (e) { failed++; }
    });

    await Promise.all(promises);
    process.stdout.write(`  Progress: ${Math.min(i + BATCH_SIZE, photos.length)}/${photos.length} (${uploaded} ok, ${failed} fail)\r`);
  }

  console.log(`\n\n═══ Done ═══`);
  console.log(`  Uploaded: ${uploaded} full-size photos`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
