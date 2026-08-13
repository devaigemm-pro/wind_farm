/**
 * Fix FDM-T03 photos:
 * 1. Update storage_path to use inspection-imports/ prefix
 * 2. Download thumbnails from Skyvisor and upload to Supabase Storage
 * 3. Download originals and upload to Supabase Storage
 * 
 * This makes the photos render correctly in the UI.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';
const CAMPAIGN_ID = '54e41928-afdf-43cf-984c-acdaf8e1b746';
const BUCKET = 'asset-documents';
const CONCURRENCY = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('═══ Fix FDM-T03 Photos ═══\n');

  await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  console.log('✓ Authenticated');

  // Get all photo records
  const { data: photos, error } = await supabase
    .from('inspection_photo')
    .select('id, filename, storage_path, metadata')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('flight_plan_order');

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  console.log(`✓ Found ${photos.length} photo records\n`);

  // Step 1: Update storage_path to add inspection-imports/ prefix
  const needsUpdate = photos.filter(p => !p.storage_path.startsWith('inspection-imports/'));
  if (needsUpdate.length > 0) {
    console.log(`Updating ${needsUpdate.length} storage paths...`);
    for (let i = 0; i < needsUpdate.length; i += 50) {
      const batch = needsUpdate.slice(i, i + 50);
      for (const photo of batch) {
        const newPath = `inspection-imports/${photo.storage_path}`;
        await supabase.from('inspection_photo').update({ storage_path: newPath }).eq('id', photo.id);
      }
    }
    console.log('✓ Storage paths updated\n');
    // Refresh
    photos.forEach(p => { if (!p.storage_path.startsWith('inspection-imports/')) p.storage_path = 'inspection-imports/' + p.storage_path; });
  }

  // Step 2: Download thumbnails from Skyvisor and upload to Storage
  const thumbUrls = JSON.parse(readFileSync('/tmp/all-skyvisor-urls.json', 'utf-8'));
  const originalUrls = JSON.parse(readFileSync('/tmp/skyvisor-original-urls.json', 'utf-8'));
  
  // Build filename → URLs map
  const urlMap = {};
  const metaFile = JSON.parse(readFileSync('/tmp/skyvisor-photos-meta.json', 'utf-8'));
  for (let i = 0; i < metaFile.length; i++) {
    urlMap[metaFile[i].photoId] = { thumb: thumbUrls[i], original: originalUrls[i] };
  }

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < photos.length; i += CONCURRENCY) {
    const batch = photos.slice(i, Math.min(i + CONCURRENCY, photos.length));
    
    await Promise.all(batch.map(async (photo) => {
      const urls = urlMap[photo.filename];
      if (!urls) { failed++; return; }

      try {
        // Download and upload thumbnail
        const thumbResp = await fetch(urls.thumb);
        if (!thumbResp.ok) { failed++; return; }
        const thumbBuffer = Buffer.from(await thumbResp.arrayBuffer());
        
        const thumbPath = photo.storage_path.replace(/\/([^/]+)$/, '/thumb_$1');
        await supabase.storage.from(BUCKET).upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg', upsert: true });

        // Download and upload original
        const origResp = await fetch(urls.original);
        if (!origResp.ok) { failed++; return; }
        const origBuffer = Buffer.from(await origResp.arrayBuffer());
        
        await supabase.storage.from(BUCKET).upload(photo.storage_path, origBuffer, { contentType: 'image/jpeg', upsert: true });
        
        uploaded++;
      } catch (e) {
        failed++;
      }
    }));

    const progress = Math.min(i + CONCURRENCY, photos.length);
    if (progress % 10 === 0 || progress === photos.length) {
      process.stdout.write(`  Progress: ${progress}/${photos.length} (${uploaded} ok, ${failed} fail)\n`);
    }
  }

  console.log(`\n═══ Done ═══`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed: ${failed}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
