import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createWorker } from 'https://esm.sh/tesseract.js@6'
import { withCors } from '../_shared/cors.ts'

// OCR of the "Coating Method" line off a Vestas blade label.
//
// This runs OCR SERVER-SIDE (Deno runtime) instead of in the browser: in the
// edge/Deno environment the tesseract.js worker + wasm + traineddata load
// quickly from the CDN and don't compete with the browser's main thread, so
// this is the effective option that the user asked for.
//
// Body: { imageUrl: string }
// Response: { coatingMethod: string | null, rawText?: string }
//   - coatingMethod = whatever follows the first ":" on the "coating method"
//     line, with whitespace normalized. null when the label isn't found.
//   - Not finding the label is NOT an error (200 + null).
//   - Only real failures (OCR crash, bad body) return 4xx/5xx.

/** Extracts the value after "coating method:" from raw OCR text. */
function parseCoatingMethod(text: string): string | null {
  if (!text) return null
  const lines = text.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (!/coating\s*method/i.test(line)) continue

    // Prefer the text after the first ":" on the matched line.
    const colonIdx = line.indexOf(':')
    let value =
      colonIdx >= 0 ? line.slice(colonIdx + 1) : line.replace(/coating\s*method/i, '')
    value = value.replace(/\s+/g, ' ').trim()
    if (value) return value
  }
  return null
}

serve(
  withCors(async (req) => {
    try {
      // Validate the authorization header (same pattern as the other functions).
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization header' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // Parse the request body.
      const { imageUrl } = await req.json()
      if (!imageUrl || typeof imageUrl !== 'string') {
        return new Response(
          JSON.stringify({ error: 'imageUrl is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // Run OCR. tesseract.js accepts the image URL directly.
      const worker = await createWorker('eng')
      let rawText = ''
      try {
        const { data } = await worker.recognize(imageUrl)
        rawText = data?.text ?? ''
      } finally {
        await worker.terminate()
      }

      const coatingMethod = parseCoatingMethod(rawText)

      return new Response(
        JSON.stringify({ coatingMethod, rawText }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }),
)
