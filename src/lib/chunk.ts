/**
 * PostgREST `.in()` lists ride in the URL: past ~300 uuids the request fails
 * outright and supabase-js hands back `data: null` - which every caller
 * reads as "no rows" (the 17/9 production incident: profile cards emptied
 * for everyone once the member list crossed the limit). Query in chunks.
 */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Supabase answers at most 1,000 rows per request whatever `.limit()` asks
 * for (the owner, 14/10: subscribers "without a phone or an institution" -
 * 1,047 phone answers, 1,000 came back, the rest showed as missing). Read a
 * whole result set in 1,000-row pages; a failed page throws.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(`paged_query_failed: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

/**
 * Run a PostgREST query once per id-chunk and concatenate the rows. A failed
 * chunk throws - a silent "no rows" is exactly the bug this exists to stop.
 */
export async function inChunks<T>(
  ids: string[],
  run: (part: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 100
): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunk(ids, size)) {
    const { data, error } = await run(part);
    if (error) throw new Error(`chunked_query_failed: ${error.message}`);
    out.push(...(data ?? []));
  }
  return out;
}
