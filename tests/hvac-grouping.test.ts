import { describe, expect, it } from "vitest";
import { BUILDING_NAMES, buildingOf, systemOf } from "../src/lib/cmms";

describe("per-building HVAC grouping", () => {
  it.each(BUILDING_NAMES.filter((building) => building !== "Safety Equipment"))(
    "keeps HVAC in its own group within %s",
    (building) => {
      const name = `${building} HVAC Unit 1`;
      expect(buildingOf(name, null, null, building)).toBe(building);
      expect(systemOf(name, building, null, null, `${building} System`)).toBe("HVAC & Climate System");
    },
  );

  it.each(["Headworks", "RDT Building", "Blower Building", "UV Building", "Aeration Basins 1–6"])(
    "includes exhaust fans in %s HVAC instead of the process group",
    (building) => {
      expect(systemOf(`${building} Exhaust Fan 1 Local Disconnect`, building, null, null, "Electrical"))
        .toBe("HVAC & Climate System");
    },
  );

  it("recognizes HVAC class and common ventilation equipment labels", () => {
    expect(systemOf("Unit 1", "Admin", null, "HVAC")).toBe("HVAC & Climate System");
    for (const name of ["Aeration Basin Make Up Air Unit 7", "Digester Unit Heater", "Admin HVAC Condensor", "Headworks Exhaust-Fan", "RDT Air Handler"] ) {
      expect(systemOf(name, "Admin")).toBe("HVAC & Climate System");
    }
  });

  it("does not move process blowers or mixers into HVAC", () => {
    expect(systemOf("Aeration Blower 1", "Blower Building")).toBe("Aeration & Blower System");
    expect(systemOf("RDT Drive Motor", "RDT Building")).toBe("RDT System");
    expect(systemOf("Digester Gas Mixer", "East Digester")).toBe("Digester & Biogas System");
  });
});