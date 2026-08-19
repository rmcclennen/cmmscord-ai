import type { Tables } from "@/integrations/supabase/types";

export type Asset = Tables<"assets">;
export type PmSchedule = Tables<"pm_schedules">;
export type WorkOrder = Tables<"work_orders">;
export type MaintenanceInfo = Tables<"asset_maintenance_info">;
export type Profile = Tables<"profiles">;

export const CLASS_LABELS: Record<string, string> = {
  PMP: "Pump",
  MOT: "Motor",
  MIX: "Mixer",
  HVAC: "HVAC",
  ELD: "Electrical",
  SAFETY: "Safety",
  TNK: "Tank",
  STR: "Structure",
  PEQ: "Process Equipment",
  PEW: "Equipment",
  INF: "Infrastructure",
};

export const WO_STATUSES = ["open", "in_progress", "on_hold", "completed", "cancelled"] as const;
export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const WO_TYPES = ["corrective", "preventive", "emergency", "inspection", "project"] as const;

export function classLabel(cls: string | null) {
  if (!cls) return "Unclassified";
  return CLASS_LABELS[cls] ?? cls;
}

export function prettyLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function daysUntil(date: string | null) {
  if (!date) return null;
  const diff =
    new Date(date + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime();
  return Math.round(diff / 86400000);
}

export function dueTone(date: string | null): "overdue" | "due" | "ok" {
  const d = daysUntil(date);
  if (d === null) return "ok";
  if (d < 0) return "overdue";
  if (d <= 7) return "due";
  return "ok";
}

export function manualList(manuals: string | null) {
  if (!manuals) return [];
  return manuals
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "03-15" -> "Mar 15" */
export function seasonLabel(startMd: string | null, endMd: string | null) {
  if (!startMd || !endMd) return null;
  const fmt = (md: string) => {
    const [m, d] = md.split("-").map(Number);
    return `${MONTHS[(m ?? 1) - 1]} ${d}`;
  };
  return `${fmt(startMd)} – ${fmt(endMd)}`;
}

function mdOf(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Pushes a due date into the seasonal operating window (e.g. UV runs Mar 15 – Nov 15).
 * Dates before the season start move to the start; dates after the season end move to
 * next year's season start.
 */
export function clampToSeason(dueDate: string, startMd: string | null, endMd: string | null) {
  if (!startMd || !endMd) return dueDate;
  const due = new Date(dueDate + "T00:00:00");
  const md = mdOf(due);
  const year = due.getFullYear();
  if (md < startMd) return iso(new Date(`${year}-${startMd}T00:00:00`));
  if (md > endMd) return iso(new Date(`${year + 1}-${startMd}T00:00:00`));
  return dueDate;
}

/** Plant areas / buildings, matched against asset + PM text (first match wins). */
const BUILDING_RULES: Array<[string, RegExp]> = [
  [
    "Safety Equipment",
    /fire extinguish|extinguisher|eye ?wash|safety shower|\bscba\b|\baed\b|gas detect|fall protection|first aid|fire alarm|sprinkler|confined space|lockout/i,
  ],
  ["Headworks", /headworks|bar screen|washing compactor|grit|vortex|septic receiving|vac truck/i],
  [
    "Solids Handling",
    /centrifuge|rotary drum thickener|\brdt\b|dewater|sludge cake|silo|schwing|polymer/i,
  ],
  ["Digester Complex", /digester|gas |boiler|\bp4\b|methane/i],
  ["Primary Clarifiers", /primary clarifier|primary sludge|scum/i],
  ["Aeration", /aeration|blower|mixer|\bras\b|\bwas\b|diffuser/i],
  ["Final Clarifiers", /final clarifier/i],
  ["Disinfection / UV", /disinfection|\buv\b|trojan|chlorine|contact basin|hypo/i],
  ["Pump Houses", /pump house|wet well|lift station|effluent pump/i],
  [
    "Administration",
    /administration|admin building|lab |laboratory|office|maintenance shop|garage/i,
  ],
  [
    "Plant Utilities",
    /air compressor|air dryer|hvac|make up air|generator|water system|plant water/i,
  ],
  ["Renewable Fuels", /\bRF\b|renewable fuel/i],
];

/** Ordered list of building/area names used for tabs and filters. */
export const BUILDING_NAMES = BUILDING_RULES.map(([name]) => name);

/** Every selectable building/area, including the catch-all buckets. */
export const ALL_BUILDING_OPTIONS = [...BUILDING_NAMES, "Lift Stations", "Other / Unassigned"];

export function buildingOf(
  assetName?: string | null,
  title?: string | null,
  location?: string | null,
  override?: string | null,
) {
  if (override && override.trim()) return override.trim();
  const text = `${assetName ?? ""} ${title ?? ""}`;
  for (const [name, re] of BUILDING_RULES) if (re.test(text)) return name;
  if (location && /lift/i.test(location)) return "Lift Stations";
  return "Other / Unassigned";
}

/** Standard Wastewater Process Systems */
export const SYSTEM_RULES: Array<{
  name: string;
  category: string;
  icon: string;
  color: string;
  test: (text: string, bldg: string) => boolean;
}> = [
  {
    name: "Headworks Polymer System",
    category: "Chemical / Pretreatment",
    icon: "FlaskConical",
    color: "purple",
    test: (t, b) =>
      (/polymer|poly feed|poly pump|poly blend|poly make-up|emulsion polymer/i.test(t) &&
        (/headworks/i.test(b) || /headworks/i.test(t))) ||
      /headworks.*polymer|polymer.*headworks/i.test(t),
  },
  {
    name: "Solids Handling Polymer System",
    category: "Solids Treatment",
    icon: "FlaskConical",
    color: "indigo",
    test: (t, b) =>
      (/polymer|poly feed|poly pump|poly blend|poly make-up|emulsion polymer|dry polymer/i.test(
        t,
      ) &&
        (/solids/i.test(b) ||
          /dewater|thick|rdt|centrifuge/i.test(b) ||
          /dewater|thick|rdt|centrifuge/i.test(t))) ||
      /solids.*polymer|polymer.*solids|rdt.*polymer|centrifuge.*polymer/i.test(t),
  },
  {
    name: "Polymer Feed System",
    category: "Chemical Feed",
    icon: "FlaskConical",
    color: "purple",
    test: (t) =>
      /polymer|poly feed|poly pump|poly blend|poly make-up|emulsion polymer|dry polymer/i.test(t),
  },
  {
    name: "Grit System",
    category: "Preliminary Treatment",
    icon: "Hourglass",
    color: "amber",
    test: (t) =>
      /grit|vortex grit|grit pump|grit classifier|grit washer|grit snail|grit cyclone|pista grit/i.test(
        t,
      ),
  },
  {
    name: "RDT System",
    category: "Solids Thickening",
    icon: "RotateCw",
    color: "teal",
    test: (t) =>
      /rotary drum thickener|\brdt\b|drum thickener|rdt feed|rdt sludge|rdt drive|thickened sludge/i.test(
        t,
      ),
  },
  {
    name: "Centrifuge Dewatering System",
    category: "Solids Dewatering",
    icon: "Disc",
    color: "sky",
    test: (t) => /centrifuge|decanter|centrate|scroll drive|bowl drive/i.test(t),
  },
  {
    name: "Sludge Cake & Pumping System",
    category: "Solids Transport",
    icon: "Layers",
    color: "stone",
    test: (t) =>
      /schwing|cake pump|sludge cake|cake silo|cake conveyor|sludge piston pump|poppet valve/i.test(
        t,
      ),
  },
  {
    name: "Influent Screening System",
    category: "Preliminary Treatment",
    icon: "Grid",
    color: "blue",
    test: (t) =>
      /bar screen|step screen|climber screen|perforated screen|screening|screenings washer|washing compactor|monster|auger monster/i.test(
        t,
      ),
  },
  {
    name: "UV Disinfection System",
    category: "Disinfection",
    icon: "SunMedium",
    color: "violet",
    test: (t) =>
      /trojan|\buv\b|ultraviolet|uv bank|uv lamp|quartz sleeve|wiper system|uv ballast|uv controller|uv hpu|disinfection channel/i.test(
        t,
      ),
  },
  {
    name: "Aeration & Blower System",
    category: "Secondary Treatment",
    icon: "Wind",
    color: "emerald",
    test: (t) =>
      /aeration|blower|roots blower|diffuser|basin mixer|aeration tank|dissolved oxygen|\bdo probe\b/i.test(
        t,
      ),
  },
  {
    name: "Digester & Biogas System",
    category: "Anaerobic Digestion",
    icon: "Flame",
    color: "orange",
    test: (t) =>
      /digester|anaerobic digester|biogas|methane|gas mixer|gas compressor|waste gas burner|flare|digester boiler|\bp4\b|digested sludge/i.test(
        t,
      ),
  },
  {
    name: "RAS / WAS Pumping System",
    category: "Biological Sludge Return",
    icon: "Repeat",
    color: "cyan",
    test: (t) =>
      /\bras\b|\bwas\b|return activated sludge|waste activated sludge|ras pump|was pump|sludge return/i.test(
        t,
      ),
  },
  {
    name: "Primary Clarifier System",
    category: "Primary Treatment",
    icon: "Waves",
    color: "blue",
    test: (t, b) =>
      /primary clarifier|primary sludge|primary scum|primary skimmer/i.test(t) ||
      (/primary/i.test(b) && /clarifier|skimmer|sludge collector/i.test(t)),
  },
  {
    name: "Final Clarifier System",
    category: "Secondary Treatment",
    icon: "Waves",
    color: "teal",
    test: (t, b) =>
      /final clarifier|secondary clarifier|clarifier drive|weir washer|scum beach/i.test(t) ||
      (/final clarifier/i.test(b) && /clarifier|drive|weir/i.test(t)),
  },
  {
    name: "Influent Pumping System",
    category: "Plant Inflow",
    icon: "ArrowDownToLine",
    color: "indigo",
    test: (t) => /influent pump|raw sewage|influent wet well|raw influent/i.test(t),
  },
  {
    name: "Plant Water (W3) & Effluent System",
    category: "Utility Water & Discharge",
    icon: "Droplets",
    color: "sky",
    test: (t) =>
      /plant water|non-potable water|\bw3\b|utility water|effluent pump|effluent reuse|water booster/i.test(
        t,
      ),
  },
  {
    name: "Chemical Feed & Dosing System",
    category: "Chemical Treatment",
    icon: "Pipette",
    color: "rose",
    test: (t) =>
      /hypochlorite|chlorine|chemical feed|ferric|alum|caustic|sodium hypo|bisulfite|acid feed/i.test(
        t,
      ),
  },
  {
    name: "HVAC & Climate System",
    category: "Facilities & Climate",
    icon: "ThermometerSnowflake",
    color: "slate",
    test: (t) =>
      /hvac|air handler|\bahu\b|make up air|\bmua\b|exhaust fan|roof fan|unit heater|chiller|condenser/i.test(
        t,
      ),
  },
  {
    name: "Compressed Air System",
    category: "Pneumatic Utilities",
    icon: "Gauge",
    color: "zinc",
    test: (t) => /air compressor|air dryer|instrument air|sullair|ingersoll|pneumatic/i.test(t),
  },
  {
    name: "Electrical & Emergency Power System",
    category: "Power Distribution",
    icon: "Zap",
    color: "amber",
    test: (t) =>
      /generator|caterpillar|cummins|transfer switch|\bats\b|switchgear|\bmcc\b|transformer|ups system/i.test(
        t,
      ),
  },
  {
    name: "Safety & Life Protection System",
    category: "Health & Safety",
    icon: "ShieldAlert",
    color: "red",
    test: (t) =>
      /fire extinguish|extinguisher|eye ?wash|safety shower|\bscba\b|\baed\b|gas detect|fall protection|first aid/i.test(
        t,
      ),
  },
  {
    name: "Septic Receiving System",
    category: "Hauler Receiving",
    icon: "Truck",
    color: "amber",
    test: (t) => /septic receiving|septage|hauler station|waste hauler|vac truck/i.test(t),
  },
  {
    name: "Lift Station & Remote Pumping System",
    category: "Collection System",
    icon: "Building",
    color: "cyan",
    test: (t, b) =>
      /lift station|wet well|submersible lift|remote station/i.test(t) || /lift station/i.test(b),
  },
];

export const SYSTEM_NAMES = SYSTEM_RULES.map((s) => s.name);

export const ALL_SYSTEM_OPTIONS = [...SYSTEM_NAMES, "General Plant Equipment"];

/**
 * Determines the specific wastewater process system for an asset based on name,
 * building, location, class, category, and notes.
 */
export function systemOf(
  assetName?: string | null,
  building?: string | null,
  location?: string | null,
  type?: string | null,
  category?: string | null,
  override?: string | null,
): string {
  if (override && override.trim()) return override.trim();
  if (
    category &&
    category.trim() &&
    category !== "all" &&
    category !== "null" &&
    category !== "undefined"
  ) {
    return category.trim();
  }

  const bldg = building ?? buildingOf(assetName, null, location);
  const text = `${assetName ?? ""} ${type ?? ""} ${location ?? ""}`.trim();

  for (const rule of SYSTEM_RULES) {
    if (rule.test(text, bldg)) {
      return rule.name;
    }
  }

  if (bldg && bldg !== "Other / Unassigned") {
    return `${bldg} System`;
  }

  return "General Plant Equipment";
}

export function systemMeta(systemName?: string | null) {
  const found = SYSTEM_RULES.find((s) => s.name === systemName);
  if (found) {
    return {
      name: found.name,
      category: found.category,
      icon: found.icon,
      color: found.color,
    };
  }
  return {
    name: systemName || "General Plant Equipment",
    category: "General Equipment",
    icon: "Cpu",
    color: "slate",
  };
}

/** Best-effort parse of a manufacturer-stated maintenance frequency into days. */
export function frequencyToDays(frequency: string | null | undefined): number {
  const f = (frequency ?? "").toLowerCase();
  if (!f) return 90;
  const num = Number((f.match(/(\d+(?:\.\d+)?)/) ?? [])[1] ?? 1);
  if (/daily|every day|shift/.test(f)) return 1;
  if (/week/.test(f)) return Math.max(1, Math.round(num * 7)) || 7;
  if (/month/.test(f)) return Math.max(1, Math.round(num * 30)) || 30;
  if (/quarter/.test(f)) return Math.max(1, Math.round(num * 90)) || 90;
  if (/semi[- ]?annual|biannual|6 ?months/.test(f)) return 182;
  if (/annual|year/.test(f)) return Math.max(1, Math.round(num * 365)) || 365;
  if (/hour/.test(f)) return Math.max(7, Math.round(num / 24));
  if (/day/.test(f)) return Math.max(1, Math.round(num));
  return 90;
}

export interface ManufacturerSpecs {
  oilGrade: string;
  oilCapacity?: string;
  greaseType: string;
  beltSize: string;
  sealType: string;
  filterSpec?: string;
  lubeInterval: string;
  inspectionNotes: string;
}

/**
 * Returns OEM-recommended consumables, oil grade, grease spec, belt sizing,
 * mechanical seals, and filter elements based on asset classification, make, model, and name.
 */
export function getManufacturerConsumables(
  asset: {
    class?: string | null;
    name?: string | null;
    make?: string | null;
    model?: string | null;
    hp?: string | null;
    type?: string | null;
  } | null,
): ManufacturerSpecs {
  if (!asset) {
    return {
      oilGrade: "ISO VG 220 Industrial Gear Oil",
      oilCapacity: "2.0 Quarts",
      greaseType: "NLGI Grade 2 Lithium Complex EP Grease",
      beltSize: "Direct Coupled / Matched V-Belt",
      sealType: "Standard Mechanical Face Seal / Viton O-Rings",
      lubeInterval: "Grease bearings every 500 operating hours; oil change every 4,000 hrs",
      inspectionNotes: "Check oil level, seal leakage, and operating temperature monthly.",
    };
  }

  const cls = (asset.class ?? "").toUpperCase();
  const name = `${asset.name ?? ""} ${asset.type ?? ""} ${asset.model ?? ""}`.toLowerCase();
  const hp = parseFloat(asset.hp ?? "0");

  // Pumps (Centrifugal, Submersible, Progressive Cavity, Sludge)
  if (
    cls === "PMP" ||
    /pump|submersible|influent|effluent|sludge|ras|was|flygt|goulds/i.test(name)
  ) {
    return {
      oilGrade: "ISO VG 68 / ISO VG 220 Synthetic Bearing & Gear Oil (Mobil SHC 626 / Shell Omala)",
      oilCapacity: hp > 50 ? "4.5 Quarts" : "2.0 Quarts",
      greaseType: "NLGI Grade 2 Polyurea / EP Lithium Complex (Mobilgrease XHP 222)",
      beltSize: /belt/i.test(name)
        ? "Matched 3V-500 3-Strand V-Belts"
        : "Direct Drive / Lovejoy Falk Coupling Element",
      sealType: '2.5" Type 21 Viton / Silicon Carbide Faces (Double Mechanical Seal)',
      filterSpec: "Suction basket strainer / 50-Mesh seal flush filter",
      lubeInterval:
        "Grease bearings every 500 run hours (1.5 oz); flush seal buffer fluid quarterly",
      inspectionNotes:
        "Inspect seal barrier fluid reservoir level, seal leakage drops/min, and bearing vibration.",
    };
  }

  // Motors (Electric Motors - Induction, Inverter-Duty)
  if (cls === "MOT" || /motor|baldors|marathon|weg|toshiba/i.test(name)) {
    return {
      oilGrade: "N/A (Sealed or Grease Lubricated Bearings)",
      greaseType: "NLGI Grade 2 Polyurea Electric Motor Grease (Mobil Polyrex EM / Chevron SRI-2)",
      beltSize: hp > 25 ? "Gates Hi-Power II B68 (Matched 3-Band Set)" : "Single Grip B52 V-Belt",
      sealType: "V-Ring / Contact Slinger Dust Seal",
      lubeInterval: `Regrease every 2,000 operating hours (approx ${hp > 50 ? "2.5 oz" : "1.0 oz"} per bearing)`,
      inspectionNotes:
        "Do not over-grease. Clean relief plug before adding grease. Monitor casing temp (<80°C).",
    };
  }

  // Blowers & Aeration (Roots, PD, Turbo, Centrifugal)
  if (/blower|aeration|roots|gardner|kaeser|aerzen|howden/i.test(name)) {
    return {
      oilGrade: "Synthetic ISO VG 220 / ISO VG 320 Blower Lubricant (Aeon PD / Mobil SHC 630)",
      oilCapacity: "3.5 Quarts per gear housing (Drive & Idle ends)",
      greaseType: "NLGI #2 High-Temperature Synthetic EP Grease (Mobilith SHC 100)",
      beltSize: "Gates Quad-Power 4 Cogged Belts (Matched Set: 5VX-1120 or BX-75)",
      sealType: "Piston Ring Air Seals & Viton Oil Lip Seals",
      filterSpec: "10-Micron Heavy-Duty Dry Pleated Air Intake Filter Element",
      lubeInterval:
        "Oil drain & refill every 4,000 run hours (or semi-annually); clean air filters monthly",
      inspectionNotes:
        "Check oil sight glasses weekly while stopped. Verify belt tension deflection (<1/2 inch).",
    };
  }

  // Air Compressors & Dryers
  if (/compressor|sullair|ingersoll|atlas copco|quincy/i.test(name)) {
    return {
      oilGrade:
        "ISO VG 46 Rotary Screw Synthetic Compressor Fluid (Sullube 32 / Mobil Rarus SHC 1024)",
      oilCapacity: "4.0 Gallons (Complete Reservoir Drain)",
      greaseType: "NLGI Grade 2 Motor Bearing Grease",
      beltSize: "Micro-V 8-Rib Poly-V Belt / Direct Flexible Hub Coupling",
      sealType: "PTFE Lip Shaft Seal with Wear Sleeve",
      filterSpec: "Spin-on 10-Micron Full-Flow Oil Filter & 0.1-Micron Coalescing Separator",
      lubeInterval: "Fluid and separator cartridge replacement every 8,000 hours / annually",
      inspectionNotes:
        "Check condensate drain trap daily. Inspect oil level differential gauge and operating pressure.",
    };
  }

  // Clarifiers, Screens, Thickeners & Heavy Process Equipment
  if (
    cls === "PEQ" ||
    /clarifier|screen|grit|centrifuge|rdt|press|dewatering|schwing/i.test(name)
  ) {
    return {
      oilGrade: "ISO VG 460 Heavy Industrial EP Enclosed Gear Oil (Mobilgear 600 XP 460)",
      oilCapacity: "6.0 Gallons (Drive Turntable / Reducer Sump)",
      greaseType:
        "NLGI Grade 2 Water-Resistant Calcium Sulfonate EP Marine Grease (Mobil Centaur XHP 221)",
      beltSize: "ANSI #60 / #80 Heavy Roller Drive Chain with Hardened Sprockets",
      sealType: "Heavy Gland Braided PTFE/Graphite Packing with Lantern Ring",
      filterSpec: "Hydraulic return 10-micron cartridge filter",
      lubeInterval:
        "Grease turntable bearings & pivot pins weekly; sample reducer oil semi-annually",
      inspectionNotes:
        "Verify shear pin integrity, skimmer blade clearance, and torque overload switch operation.",
    };
  }

  // Mixers & Agitators
  if (cls === "MIX" || /mixer|agitator|lightnin|flygt mixer|hydro/i.test(name)) {
    return {
      oilGrade: "ISO VG 220 Synthetic Gearbox Oil (Mobil Glygoyle 220 / Omala S4 WE)",
      oilCapacity: "1.75 Gallons",
      greaseType: "NLGI Grade 2 Submersible Water-Resistant EP Grease",
      beltSize: "Inline Helical Planetary Gear Reducer (Direct Drive)",
      sealType: "Dual Tungsten Carbide Mechanical Seal in Barrier Oil Chamber",
      lubeInterval: "Oil change every 4,000 run hours; inspect prop zinc anodes semi-annually",
      inspectionNotes:
        "Check mast guide cable tension, prop clearance, and motor moisture leak sensor.",
    };
  }

  // HVAC & Make-Up Air Units
  if (cls === "HVAC" || /hvac|air handler|make up air|exhaust fan|chiller|boiler/i.test(name)) {
    return {
      oilGrade: "ISO VG 68 Refrigeration / Compressor Mineral Oil",
      oilCapacity: "1.0 Quart",
      greaseType: "NLGI Grade 2 Multi-Purpose Lithium Complex (Chevron Starplex)",
      beltSize: "Cogged V-Belts (AX-42 / BX-54 Matched Set)",
      sealType: "Neoprene Shaft Slinger Seal",
      filterSpec: "MERV 13 Pleated HVAC Filters (24x24x2 - 4 units per bank)",
      lubeInterval: "Grease fan & motor pillow block bearings quarterly (1-2 pumps max)",
      inspectionNotes:
        "Replace air filters every 60 days. Check belt alignment, sheave wear, and damper actuators.",
    };
  }

  // Default fallback
  return {
    oilGrade: "ISO VG 220 Synthetic Industrial Gear Oil",
    oilCapacity: "2.0 Quarts",
    greaseType: "NLGI Grade 2 Polyurea / EP Lithium Complex Grease",
    beltSize: "Standard Matched Industrial V-Belt (Size per Frame Sheave)",
    sealType: "Mechanical Face Seal with Viton Elastomers",
    filterSpec: "Standard fluid intake strainer",
    lubeInterval: "Grease bearings every 500 operating hours; check fluid levels monthly",
    inspectionNotes: "Inspect for vibration, heat build-up, and seal leaks during weekly rounds.",
  };
}
