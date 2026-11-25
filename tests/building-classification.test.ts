import { describe, expect, it } from "vitest";
import { buildingOf, systemOf } from "../src/lib/cmms";

describe("safety equipment building classification", () => {
  it("groups fire ext labels under Safety Equipment despite saved buildings", () => {
    expect(buildingOf("Headworks Fire Ext 1", null, null, "Headworks")).toBe("Safety Equipment");
    expect(buildingOf("Fire Extinguisher 2", null, null, "Admin")).toBe("Safety Equipment");
    expect(buildingOf("Equipment", "Inspect fire ext", null, "UV Building")).toBe("Safety Equipment");
  });
  it("groups emergency lights under Safety Equipment despite saved buildings", () => {
    expect(buildingOf("Emergency Light 1", null, null, "RDT Building")).toBe("Safety Equipment");
    expect(buildingOf(null, "Test Emergency Lights", null, "Admin")).toBe("Safety Equipment");
    expect(systemOf("Emergency Light 1", "Safety Equipment")).toBe("Safety & Life Protection System");
  });
  it("preserves the RF classification priority", () => {
    expect(buildingOf("RF Fire Ext", null, null, "Admin")).toBe("Renewable Fuels");
    expect(buildingOf("RF Emergency Light", null, null, "Admin")).toBe("Renewable Fuels");
  });
  it("leaves other equipment in its saved building", () => {
    expect(buildingOf("Emergency Pump", null, null, "Headworks")).toBe("Headworks");
  });
});