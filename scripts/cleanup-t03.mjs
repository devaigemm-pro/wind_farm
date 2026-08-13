import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');
await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });

const CAMPAIGN_ID = '54e41928-afdf-43cf-984c-acdaf8e1b746';
const INSPECTION_ID = '07a234d2-2dcf-4305-acbf-ee688104406f';

// Delete all existing photo records for this campaign
const { data, error } = await supabase.from('inspection_photo').delete().eq('campaign_id', CAMPAIGN_ID).select('id');
console.log('Deleted photo records:', data?.length ?? 0, error?.message ?? 'ok');

// Delete storage files recursively
async function deleteFolder(path) {
  const { data: items } = await supabase.storage.from('asset-documents').list(path, { limit: 1000 });
  if (!items || items.length === 0) return 0;
  
  let count = 0;
  const files = items.filter(i => i.metadata);
  const folders = items.filter(i => !i.metadata);
  
  if (files.length > 0) {
    const paths = files.map(f => path + '/' + f.name);
    const { error } = await supabase.storage.from('asset-documents').remove(paths);
    if (!error) count += paths.length;
  }
  
  for (const folder of folders) {
    count += await deleteFolder(path + '/' + folder.name);
  }
  return count;
}

const deleted = await deleteFolder('inspection-imports/' + CAMPAIGN_ID);
console.log('Storage files deleted:', deleted);

// Reset inspection stage back to planned
await supabase.from('inspection').update({ stage: 'planned' }).eq('id', INSPECTION_ID);
console.log('Inspection stage reset to planned');
