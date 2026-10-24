/**
 * Default max number of ids per batched request. PostgREST builds a GET URL
 * with every id in the query string for `.in(...)`/array-param RPCs, so large
 * lists (e.g. 700+ photo ids ≈ 28k+ chars) overflow the server URL limit and
 * get rejected with HTTP 400. Keep each batch well under that threshold.
 */
export const DEFAULT_CHUNK_SIZE = 150;

/** Split an array into consecutive chunks of at most `size` elements. */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Run `fn` over `ids` in batches of at most `chunkSize`, in parallel, and
 * concatenate the results. Used to keep `.in(...)` / array-param queries under
 * the PostgREST URL length limit (avoids HTTP 400 on very large id lists).
 */
export async function fetchInChunks<T>(
  ids: string[],
  chunkSize: number,
  fn: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  if (ids.length <= chunkSize) return fn(ids);
  const batches = chunkArray(ids, chunkSize);
  const results = await Promise.all(batches.map(fn));
  return results.flat();
}
