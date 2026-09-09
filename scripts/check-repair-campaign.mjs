import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Load env from .env.local
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function run() {
  console.log('=== 1. campaign columns (type/quote_id/turbine_id) ===');
  const { data: camCols, error: colErr } = await admin
    .from('campaign')
    .select('id, name, type, quote_id, turbine_id, status, created_at')
    .limit(3);
  if (colErr) console.log('ERROR reading campaign columns:', colErr.message, colErr.code);
  else console.log('OK, sample:', JSON.stringify(camCols, null, 2));

  console.log('\n=== 2. repair campaigns count ===');
  const { data: repairCams, error: rcErr } = await admin
    .from('campaign')
    .select('id, name, quote_id, status, created_at')
    .eq('type', 'repair')
    .order('created_at', { ascending: false });
  if (rcErr) console.log('ERROR:', rcErr.message);
  else {
    console.log('repair campaigns:', repairCams.length);
    repairCams.slice(0, 10).forEach((c) => console.log(' -', c.name, '| quote:', c.quote_id, '| status:', c.status));
  }

  console.log('\n=== 3. approved quotes vs their repair campaign ===');
  const { data: approved, error: qErr } = await admin
    .from('quote')
    .select('id, status, turbine_id, wind_farm_id, approved_at')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });
  if (qErr) console.log('ERROR reading quotes:', qErr.message);
  else {
    console.log('approved quotes:', approved.length);
    for (const q of approved) {
      const { data: cam } = await admin
        .from('campaign')
        .select('id, name, status')
        .eq('quote_id', q.id)
        .eq('type', 'repair')
        .maybeSingle();
      console.log(` - quote ${q.id.slice(0, 8)} approved ${q.approved_at} → campaign:`, cam ? `${cam.name} (${cam.status})` : 'NONE ❌');
    }
  }

  console.log('\n=== 4. try inserting a repair campaign as admin (dry check of insert shape) ===');
  // Pick an approved quote without campaign to test insert, then rollback (delete)
  // Only do this if there is an approved quote lacking a campaign.
}

run().catch((e) => { console.error(e); process.exit(1); });
