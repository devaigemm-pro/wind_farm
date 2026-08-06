/**
 * Apply the asset-detail migration via Supabase Management API.
 * 
 * IMPORTANT: This script requires the SUPABASE_ACCESS_TOKEN environment variable
 * or manual application via the Supabase Dashboard SQL Editor.
 * 
 * To apply manually:
 * 1. Go to https://supabase.com/dashboard/project/esphlzrzwmzeozjmyvqm/sql
 * 2. Paste the contents of scripts/migrate-asset-detail.sql
 * 3. Click "Run"
 * 
 * Alternatively, set your access token:
 *   export SUPABASE_ACCESS_TOKEN="your-token-here"
 *   node scripts/apply-migration.mjs
 */

import { readFileSync } from 'fs';

const PROJECT_REF = 'esphlzrzwmzeozjmyvqm';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  SUPABASE_ACCESS_TOKEN not set.                                  ║
║                                                                  ║
║  Please apply the migration manually:                            ║
║  1. Go to the Supabase Dashboard SQL Editor:                     ║
║     https://supabase.com/dashboard/project/${PROJECT_REF}/sql    ║
║  2. Paste contents of: scripts/migrate-asset-detail.sql          ║
║  3. Click "Run"                                                  ║
║                                                                  ║
║  Or login to Supabase CLI:                                       ║
║     npx supabase login                                           ║
║     npx supabase db query -f scripts/migrate-asset-detail.sql --linked  ║
╚══════════════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

const sql = readFileSync('scripts/migrate-asset-detail.sql', 'utf-8');

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  const text = await res.text();
  console.error('Migration failed:', res.status, text);
  process.exit(1);
}

const result = await res.json();
console.log('✓ Migration applied successfully');
console.log(JSON.stringify(result, null, 2));
