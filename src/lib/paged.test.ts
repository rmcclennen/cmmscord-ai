import { describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "./paged";

const source = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));
const pager = (rows: { id: number }[]) =>
  vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));

describe("fetchAllRows", () => {
  it("returns everything across several pages (the 1000-row truncation case)", async () => {
    const page = pager(source(2500));
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toEqual({ id: 2499 });
    expect(page).toHaveBeenCalledTimes(3);
  });

  it("makes one call when the result fits in a page", async () => {
    const page = pager(source(10));
    expect(await fetchAllRows(page)).toHaveLength(10);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it("makes one extra call when the total is an exact multiple of the page size", async () => {
    const page = pager(source(2000));
    expect(await fetchAllRows(page)).toHaveLength(2000);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it("handles an empty table", async () => {
    expect(await fetchAllRows(pager([]))).toEqual([]);
  });

  it("surfaces errors", async () => {
    await expect(
      fetchAllRows(async () => ({ data: null, error: { message: "boom" } })),
    ).rejects.toThrow("boom");
  });

  it("stops at maxRows", async () => {
    const page = pager(source(10_000));
    const rows = await fetchAllRows(page, { pageSize: 100, maxRows: 300 });
    expect(rows).toHaveLength(300);
  });
});
