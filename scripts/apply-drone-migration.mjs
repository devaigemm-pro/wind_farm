/**
 * Apply the drone-photos migration using Supabase Management API.
 * 
 * Requires SUPABASE_ACCESS_TOKEN env var (personal access token from supabase.com/dashboard/account/tokens)
 * OR will attempt to use the database connection string directly.
 * 
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-drone-migration.mjs
 */
import { readFileSync } from 'fs';

const PROJECT_REF = 'esphlzrzwmzeozjmyvqm';
const MIGRATION_FILE = 'scripts/migrate-drone-photos.sql';

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!accessToken) {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  SUPABASE_ACCESS_TOKEN required                                  ║
║                                                                  ║
║  Get it from:                                                    ║
║  https://supabase.com/dashboard/account/tokens                   ║
║                                                                  ║
║  Then run:                                                       ║
║  SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-drone-migration.mjs ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const sql = readFileSync(MIGRATION_FILE, 'utf8');

async function main() {
  console.log(`📦 Applying migration: ${MIGRATION_FILE}`);
  console.log(`   Project: ${PROJECT_REF}\n`);

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`❌ Migration failed (HTTP ${response.status}):`);
    console.error(text);
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Migration applied successfully!');
  if (Array.isArray(result) && result.length > 0) {
    console.log(`   Statements executed: ${result.length}`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
