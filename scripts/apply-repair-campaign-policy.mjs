/**
 * Apply the repair-campaign INSERT policy migration + backfill missing repair
 * campaigns for already-approved quotes. Uses the Supabase Management API
 * (SUPABASE_ACCESS_TOKEN) for the DDL, and the service role for the backfill.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const PROJECT_REF = env.VITE_SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) { throw new Error(`SQL failed ${res.status}: ${await res.text()}`); }
  return res.json();
}

async function main() {
  console.log('1) Applying RLS INSERT policy for repair campaigns...');
  await runSql(readFileSync(new URL('./migrate-repair-campaign-insert-policy.sql', import.meta.url), 'utf8'));
  console.log('   ✓ policy applied');

  console.log('2) Verifying policy exists...');
  const pol = await runSql(`SELECT policyname, cmd FROM pg_policies WHERE tablename='campaign' AND policyname='Authenticated users can create repair campaigns';`);
  console.log('   policy:', JSON.stringify(pol));

  console.log('3) Backfilling repair campaigns for approved quotes missing one...');
  const { data: approved } = await admin.from('quote').select('*').eq('status', 'approved');
  let created = 0;
  for (const q of approved ?? []) {
    const { data: existing } = await admin
      .from('campaign').select('id').eq('quote_id', q.id).eq('type', 'repair').maybeSingle();
    if (existing) continue;
    // Resolve turbine name for the campaign label
    const { data: turb } = await admin.from('turbine').select('name').eq('id', q.turbine_id).maybeSingle();
    const turbineName = turb?.name?.trim() || (q.turbine_id ? `turbina ${q.turbine_id.slice(0, 8)}` : 'turbina');
    const dateLabel = new Date(q.approved_at ?? Date.now()).toLocaleDateString('es-CL');
    const name = `Reparación - ${turbineName} - ${dateLabel}`;
    const { error } = await admin.from('campaign').insert({
      type: 'repair', name, wind_farm_id: q.wind_farm_id, turbine_id: q.turbine_id,
      quote_id: q.id, status: 'repair_open', created_by: q.approved_by ?? null,
    });
    if (error) console.log(`   ✗ quote ${q.id.slice(0, 8)}: ${error.message}`);
    else { console.log(`   ✓ created campaign for quote ${q.id.slice(0, 8)}: ${name}`); created++; }
  }
  console.log(`   backfill done, created ${created} campaign(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
