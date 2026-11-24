import { describe, it, expect } from "vitest";
import { findSimilarAssets } from "../src/lib/similar-assets";

const all = [
  { id: "1", name: "Aeration Blower 1" },
  { id: "2", name: "Aeration Blower #2" },
  { id: "3", name: "Aeration Blower 3" },
  { id: "4", name: "Aeration Blower 4" },
  { id: "5", name: "RDT 1", make: "Parkson", model: "R-100" },
  { id: "6", name: "Rotary Drum Thickener 2", make: "parkson", model: "r-100" },
  { id: "7", name: "Primary Clarifier 1" },
];

describe("findSimilarAssets", () => {
  it("matches blowers 1-4 by name ignoring unit number", () => {
    expect(findSimilarAssets(all[0]!, all).map((a) => a.id)).toEqual(["2", "3", "4"]);
  });
  it("matches same make and model even with different names", () => {
    expect(findSimilarAssets(all[4]!, all).map((a) => a.id)).toEqual(["6"]);
  });
  it("does not match unrelated equipment", () => {
    expect(findSimilarAssets(all[6]!, all)).toEqual([]);
  });
});
