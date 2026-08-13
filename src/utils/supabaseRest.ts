/**
 * Direct REST API calls to Supabase — bypasses supabase-js SDK
 * which hangs due to navigator.locks issues in certain contexts.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getAccessToken(): string {
  const keys = Object.keys(localStorage);
  const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  if (authKey) {
    try {
      const data = JSON.parse(localStorage.getItem(authKey) || '{}');
      if (data.access_token) return data.access_token;
    } catch { /* fallback */ }
  }
  return SUPABASE_KEY;
}

function getUserId(): string {
  const keys = Object.keys(localStorage);
  const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  if (authKey) {
    try {
      const data = JSON.parse(localStorage.getItem(authKey) || '{}');
      if (data.user?.id) return data.user.id;
    } catch { /* fallback */ }
  }
  return 'a1b2c3d4-0003-4000-8000-000000000003';
}

function headers(): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${getAccessToken()}`,
    'Content-Type': 'application/json',
  };
}

export async function restSelect(table: string, params: string): Promise<any[]> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: headers() });
  if (!resp.ok) return [];
  return resp.json();
}

export async function restInsert(table: string, row: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (resp.ok) return { ok: true };
  const text = await resp.text();
  return { ok: false, error: `${resp.status}: ${text}` };
}

export { getUserId };
