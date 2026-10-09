import { describe, expect, it } from "vitest";
import { nextDueAfter } from "./pm-complete-dialog";

describe("nextDueAfter", () => {
  it("adds the interval to the completion date", () => {
    expect(nextDueAfter("2026-10-08", 30, null, null)).toBe("2026-11-07");
    expect(nextDueAfter("2026-12-20", 30, null, null)).toBe("2027-01-19");
  });
  it("pushes seasonal PMs into their season", () => {
    const r = nextDueAfter("2026-10-08", 30, "05-01", "09-30");
    expect(r >= "2027-05-01").toBe(true);
  });
});
