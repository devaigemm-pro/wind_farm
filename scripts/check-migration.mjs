import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://esphlzrzwmzeozjmyvqm.supabase.co',
  'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v'
);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'password123',
  });
  if (authErr) { console.error('Auth failed:', authErr.message); return; }
  console.log('Signed in as admin');

  // Test campaign table
  const { data, error } = await supabase.from('campaign').select('id').limit(1);
  if (error) {
    console.log('campaign table:', error.message, '(code:', error.code, ')');
  } else {
    console.log('campaign table exists, rows:', data?.length ?? 0);
  }

  // Test inspection extra columns
  const { data: insp, error: inspErr } = await supabase.from('inspection').select('id, campaign_id, inspection_type, photos_count, viewed_percent, notes').limit(1);
  if (inspErr) {
    console.log('inspection columns:', inspErr.message);
  } else {
    console.log('inspection has new columns ✓');
  }

  // Test turbine serial columns
  const { data: turb, error: turbErr } = await supabase.from('turbine').select('id, serial_number, tower_serial_number, anticlockwise, powering_date').limit(1);
  if (turbErr) {
    console.log('turbine serial columns:', turbErr.message);
  } else {
    console.log('turbine has serial columns ✓');
  }

  // Test asset_document table
  const { data: doc, error: docErr } = await supabase.from('asset_document').select('id').limit(1);
  if (docErr) {
    console.log('asset_document table:', docErr.message, '(code:', docErr.code, ')');
  } else {
    console.log('asset_document table exists ✓');
  }

  // Test RPC functions
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_wind_farm_detail', { p_wind_farm_id: 'f0000000-0001-4000-8000-000000000001' });
  if (rpcErr) {
    console.log('get_wind_farm_detail RPC:', rpcErr.message);
  } else {
    console.log('get_wind_farm_detail RPC works ✓', rpcData?.[0]?.name ?? '');
  }
}

run();
