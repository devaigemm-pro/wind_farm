import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const { data: anns } = await supabase.from('annotation').select('id, thumbnail_id, type, category').eq('inspection_id', 'abe05885-3c6c-45f1-8550-5006b16118e2');
  console.log('Annotations:');
  for (const a of (anns || [])) {
    console.log(`  ${a.type} | thumbnail_id: ${a.thumbnail_id}`);
  }

  // Check if thumbnail_ids reference inspection_photo
  const thumbIds = (anns || []).map(a => a.thumbnail_id).filter(Boolean);
  if (thumbIds.length > 0) {
    const { data: photos } = await supabase.from('inspection_photo').select('id, storage_path, filename').in('id', thumbIds);
    console.log('\nMatching photos:', photos?.length);
    photos?.forEach(p => console.log(`  ${p.id} → ${p.storage_path}`));
  }

  // Also check what inspection_photos exist for this campaign
  const { data: allPhotos } = await supabase.from('inspection_photo').select('id, storage_path, blade_id, filename').eq('campaign_id', '1118f958-4b94-452c-a215-63c37fd70a44').limit(10);
  console.log('\nCampaign photos:', allPhotos?.length);
  allPhotos?.forEach(p => console.log(`  ${p.id} | ${p.filename} | ${p.storage_path}`));

  process.exit(0);
}
main();
