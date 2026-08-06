import { createClient } from '@supabase/supabase-js';

const c = createClient(
  'https://esphlzrzwmzeozjmyvqm.supabase.co',
  'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v'
);

async function run() {
  const { error: authErr } = await c.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'password123',
  });
  if (authErr) { console.error(authErr.message); process.exit(1); }

  // Delete ALL annotations so auto-seed re-creates them with rootCause/nextStep
  const { error } = await c.from('annotation').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(error ? 'Error: ' + error.message : 'Deleted all annotations successfully');
}

run();
