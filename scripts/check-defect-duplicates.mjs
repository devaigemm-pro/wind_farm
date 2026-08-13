import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://esphlzrzwmzeozjmyvqm.supabase.co', 'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v');

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@windfarm.dev', password: 'Password123!' });
  if (authErr) { console.error('Auth:', authErr.message); process.exit(1); }

  const INSPECTION_ID = 'abe05885-3c6c-45f1-8550-5006b16118e2';

  // Get all defects for this inspection
  const { data: defects } = await supabase.from('defect').select('id, type, severity, description, distance_from_root, created_at').eq('inspection_id', INSPECTION_ID).order('created_at');
  console.log('Defects:', defects?.length);
  defects?.forEach(d => console.log(`  ${d.id} | type:${d.type} | sev:${d.severity} | desc:${d.description} | dist:${d.distance_from_root} | ${d.created_at}`));

  // Check for duplicates by description (annotationId)
  const descCounts = {};
  for (const d of (defects || [])) {
    if (d.description) {
      descCounts[d.description] = (descCounts[d.description] || 0) + 1;
    }
  }
  const duplicates = Object.entries(descCounts).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('\nDUPLICATES FOUND:');
    duplicates.forEach(([desc, count]) => console.log(`  annotationId ${desc}: ${count} entries`));
  } else {
    console.log('\nNo duplicates by annotationId');
  }

  // Also check annotations count
  const { count: annCount } = await supabase.from('annotation').select('id', { count: 'exact', head: true }).eq('inspection_id', INSPECTION_ID);
  console.log(`\nAnnotations for this inspection: ${annCount}`);

  process.exit(0);
}
main();
