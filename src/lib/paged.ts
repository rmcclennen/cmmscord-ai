/**
 * Supabase / PostgREST returns at most 1,000 rows per request. A plain `.select()`
 * silently truncates anything larger, so lists look complete while quietly missing
 * rows. `fetchAllRows` walks the result in pages until it has everything.
 */

export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * @param fetchPage returns one slice, e.g. `(from, to) => supabase.from("assets").select("*").order("name").range(from, to)`
 *                  Include a stable `.order()` so pages don't overlap or skip.
 * @param maxRows   safety valve against runaway loops (default 50,000)
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { pageSize = PAGE_SIZE, maxRows = 50_000 }: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
