import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const PROJECT_REF = env.VITE_SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];
const TOKEN = env.SUPABASE_ACCESS_TOKEN;

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('Applying repair-status trigger + backfill...');
  await runSql(readFileSync(new URL('./migrate-repair-status-trigger.sql', import.meta.url), 'utf8'));
  console.log('✓ applied');

  console.log('\nVerifying trigger exists:');
  console.log(JSON.stringify(await runSql(`SELECT tgname FROM pg_trigger WHERE tgname='repair_recompute_campaign';`)));

  console.log('\nRepair campaign status after backfill:');
  console.log(JSON.stringify(await runSql(`
    SELECT c.name, c.status,
           (SELECT COUNT(*) FROM work_order wo WHERE wo.quote_id=c.quote_id) AS total_wo,
           (SELECT COUNT(*) FROM work_order wo JOIN repair r ON r.work_order_id=wo.id WHERE wo.quote_id=c.quote_id AND r.status='completed') AS done
    FROM campaign c WHERE c.type='repair' ORDER BY c.created_at DESC;`), null, 2));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
