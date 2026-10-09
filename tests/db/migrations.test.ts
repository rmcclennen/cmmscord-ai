import { describe, expect, it } from "vitest";
import { createDb } from "./harness";

describe("migrations", () => {
  it("replay cleanly from scratch", async () => {
    const db = await createDb();
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(rows[0]!.n).toBeGreaterThan(10);
  });
});
