/**
 * Download photos from Skyvisor and upload to Supabase Storage.
 * Updates existing inspection_photo records with correct storage paths.
 * 
 * Uses 'asset-documents' bucket (which has proper RLS policies).
 * Photos are stored as: inspection-imports/{campaignId}/{bladeId}/{face}/{filename}
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v';
const CAMPAIGN_ID = '1118f958-4b94-452c-a215-63c37fd70a44';
const BUCKET = 'asset-documents';
const BATCH_SIZE = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('═══ Upload Skyvisor Photos to Storage ═══\n');
  
  // Auth
  await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  console.log('✓ Authenticated\n');
  
  // Get all photo records for this campaign
  const { data: photos, error } = await supabase
    .from('inspection_photo')
    .select('id, filename, blade_id, face, flight_plan_order, metadata')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('flight_plan_order');
  
  if (error) { console.error('DB error:', error.message); process.exit(1); }
  console.log(`Found ${photos.length} photo records to process\n`);
  
  let uploaded = 0;
  let failed = 0;
  
  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (photo) => {
      const meta = photo.metadata || {};
      const thumbUrl = meta.external_thumb_url;
      if (!thumbUrl) { failed++; return; }
      
      try {
        // Download thumbnail from Skyvisor
        const resp = await fetch(thumbUrl);
        if (!resp.ok) { failed++; return; }
        const buffer = Buffer.from(await resp.arrayBuffer());
        
        // Upload to asset-documents bucket
        const storagePath = `inspection-imports/${CAMPAIGN_ID}/${photo.blade_id}/${photo.face}/${photo.flight_plan_order}_${photo.filename}`;
        
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });
        
        if (upErr) { failed++; return; }
        
        // Update record with actual storage path
        await supabase
          .from('inspection_photo')
          .update({ storage_path: storagePath, thumbnail_path: storagePath })
          .eq('id', photo.id);
        
        uploaded++;
      } catch (e) { failed++; }
    });
    
    await Promise.all(promises);
    process.stdout.write(`  Progress: ${Math.min(i + BATCH_SIZE, photos.length)}/${photos.length} (${uploaded} ok, ${failed} fail)\r`);
  }
  
  console.log(`\n\n═══ Done ═══`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed: ${failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
