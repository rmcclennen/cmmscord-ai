import { describe, expect, it } from "vitest";
import { summarizeChanges } from "./audit";

describe("summarizeChanges", () => {
  it("shows old and new values for updates", () => {
    expect(
      summarizeChanges("UPDATE", {
        status: { old: "open", new: "done" },
        notes: { old: null, new: "ok" },
      }),
    ).toEqual(["status: open → done", "notes: empty → ok"]);
  });
  it("lists fields for inserts and truncates long values and lists", () => {
    const lines = summarizeChanges("INSERT", { a: "x".repeat(100), b: 1, c: 2 }, 2);
    expect(lines[0]!.length).toBeLessThan(70);
    expect(lines[2]).toBe("+1 more");
  });
  it("tolerates junk", () => {
    expect(summarizeChanges("UPDATE", null)).toEqual([]);
    expect(summarizeChanges("UPDATE", "x")).toEqual([]);
  });
});
