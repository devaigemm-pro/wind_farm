import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local');
}

// supabase-js guards session reads with `navigator.locks.request(...)` when
// that API is available. In some browsers (private mode, some extensions,
// service-worker interference) the lock can never resolve, which makes
// `auth.getSession()` hang forever with no error, and the app stays on the
// AuthGuard loading spinner. Providing a passthrough lock skips the API and
// executes the callback immediately -- this is the same behaviour the SDK
// falls back to in non-browser environments.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
});
