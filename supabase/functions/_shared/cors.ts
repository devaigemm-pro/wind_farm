// Shared CORS helper for all edge functions.
//
// The Supabase Edge Functions gateway does NOT automatically inject CORS
// headers. A browser calling `supabase.functions.invoke(...)` from a
// different origin (Vercel prod, localhost dev) sends a CORS preflight
// OPTIONS request first. If the function does not respond to OPTIONS
// with the right headers, the browser aborts with:
//   "Response to preflight request doesn't pass access control check"
//
// `withCors` wraps a handler so that:
//   - OPTIONS requests short-circuit with a 200 + CORS headers
//   - every other response has the CORS headers merged in
//
// If we ever want to lock the origin down instead of `*`, change
// ALLOWED_ORIGIN below (or make it a per-project env-derived value).

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

export function withCors(
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { status: 200, headers: corsHeaders })
    }

    const resp = await handler(req)
    const merged = new Headers(resp.headers)
    for (const [key, value] of Object.entries(corsHeaders)) {
      merged.set(key, value)
    }
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: merged,
    })
  }
}
