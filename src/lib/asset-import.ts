import { supabase } from "@/integrations/supabase/client";
import { buildingOf } from "@/lib/cmms";

export interface ParsedAssetRow {
  name: string;
  tag_number?: string;
  class?: string;
  make?: string;
  model?: string;
  serial_number?: string;
  location_name?: string;
  building?: string;
  manufacturer?: string;
  supplier?: string;
  hp?: string;
  volts?: string;
  rpm?: string;
  frame?: string;
  criticality?: "low" | "medium" | "high";
  status?: string;
  notes?: string;
  category?: string;
}

export interface ColumnMapping {
  name: string;
  tag_number: string;
  class: string;
  make: string;
  model: string;
  serial_number: string;
  location_name: string;
  building: string;
  manufacturer: string;
  supplier: string;
  hp: string;
  volts: string;
  rpm: string;
  frame: string;
  criticality: string;
  notes: string;
}

export const KNOWN_FIELDS: Array<{ key: keyof ColumnMapping; label: string; required?: boolean }> =
  [
    { key: "name", label: "Asset Name / Equipment Description", required: true },
    { key: "tag_number", label: "Tag / Asset #" },
    { key: "class", label: "Class / Category (e.g., PMP, MOT, MIX, HVAC)" },
    { key: "make", label: "Make / Manufacturer" },
    { key: "model", label: "Model Number" },
    { key: "serial_number", label: "Serial Number" },
    { key: "location_name", label: "Location / Room" },
    { key: "building", label: "Building / Plant Area" },
    { key: "manufacturer", label: "Manufacturer Brand" },
    { key: "supplier", label: "Vendor / Supplier" },
    { key: "hp", label: "Horsepower (HP)" },
    { key: "volts", label: "Voltage (Volts)" },
    { key: "rpm", label: "RPM Speed" },
    { key: "frame", label: "Frame Size" },
    { key: "criticality", label: "Criticality (low / medium / high)" },
    { key: "notes", label: "Operating Notes / Specs" },
  ];

/**
 * Auto-detects matching column headers from user's uploaded spreadsheet.
 */
export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    name: "",
    tag_number: "",
    class: "",
    make: "",
    model: "",
    serial_number: "",
    location_name: "",
    building: "",
    manufacturer: "",
    supplier: "",
    hp: "",
    volts: "",
    rpm: "",
    frame: "",
    criticality: "",
    notes: "",
  };

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  headers.forEach((raw) => {
    const c = clean(raw);
    if (!mapping.name && /assetname|equipmentname|description|itemname|name|equipment/i.test(c)) {
      mapping.name = raw;
    } else if (!mapping.tag_number && /tag|tagno|tagnumber|assetid|assetno|barcode/i.test(c)) {
      mapping.tag_number = raw;
    } else if (!mapping.class && /class|category|type|equipmenttype/i.test(c)) {
      mapping.class = raw;
    } else if (!mapping.make && /make|brand|mfg/i.test(c)) {
      mapping.make = raw;
    } else if (!mapping.model && /model|modelno|modelnumber/i.test(c)) {
      mapping.model = raw;
    } else if (!mapping.serial_number && /serial|serialno|serialnumber|sn/i.test(c)) {
      mapping.serial_number = raw;
    } else if (!mapping.location_name && /location|room|area|facility/i.test(c)) {
      mapping.location_name = raw;
    } else if (!mapping.building && /building|plantarea|structure|zone/i.test(c)) {
      mapping.building = raw;
    } else if (!mapping.manufacturer && /manufacturer|oem/i.test(c)) {
      mapping.manufacturer = raw;
    } else if (!mapping.supplier && /supplier|vendor|distributor/i.test(c)) {
      mapping.supplier = raw;
    } else if (!mapping.hp && /hp|horsepower|power/i.test(c)) {
      mapping.hp = raw;
    } else if (!mapping.volts && /volt|voltage|vac/i.test(c)) {
      mapping.volts = raw;
    } else if (!mapping.rpm && /rpm|speed/i.test(c)) {
      mapping.rpm = raw;
    } else if (!mapping.frame && /frame|framesize/i.test(c)) {
      mapping.frame = raw;
    } else if (!mapping.criticality && /critical|priority|importance/i.test(c)) {
      mapping.criticality = raw;
    } else if (!mapping.notes && /notes|comments|memo|specs/i.test(c)) {
      mapping.notes = raw;
    }
  });

  return mapping;
}

/**
 * Parses raw CSV string into rows and headers safely.
 */
export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === "," || char === "\t") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Maps raw records to structured Asset objects according to column mapping.
 */
export function transformRowsToAssets(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping,
): ParsedAssetRow[] {
  return rawRows
    .map((r) => {
      const name = (r[mapping.name] || "").trim();
      if (!name) return null;

      const tag_number = (r[mapping.tag_number] || "").trim() || undefined;
      const rawClass = (r[mapping.class] || "").trim().toUpperCase();
      let cls = "PEQ";
      if (/PUMP|PMP/.test(rawClass)) cls = "PMP";
      else if (/MOTOR|MOT/.test(rawClass)) cls = "MOT";
      else if (/MIXER|MIX/.test(rawClass)) cls = "MIX";
      else if (/HVAC|AC|FAN/.test(rawClass)) cls = "HVAC";
      else if (/ELEC|PANEL|ELD/.test(rawClass)) cls = "ELD";
      else if (/SAFE|EXTINGUISH/.test(rawClass)) cls = "SAFETY";
      else if (/TANK|TNK/.test(rawClass)) cls = "TNK";
      else if (rawClass) cls = rawClass;

      const rawCrit = (r[mapping.criticality] || "").toLowerCase();
      let criticality: "low" | "medium" | "high" = "medium";
      if (rawCrit.includes("high") || rawCrit.includes("crit") || rawCrit === "1")
        criticality = "high";
      if (rawCrit.includes("low") || rawCrit === "3") criticality = "low";

      const location_name = (r[mapping.location_name] || "").trim() || undefined;
      const buildingExplicit = (r[mapping.building] || "").trim() || undefined;
      const computedBuilding = buildingOf(name, null, location_name, buildingExplicit);

      return {
        name,
        tag_number,
        class: cls,
        make: (r[mapping.make] || "").trim() || undefined,
        model: (r[mapping.model] || "").trim() || undefined,
        serial_number: (r[mapping.serial_number] || "").trim() || undefined,
        location_name,
        building: computedBuilding,
        manufacturer: (r[mapping.manufacturer] || r[mapping.make] || "").trim() || undefined,
        supplier: (r[mapping.supplier] || "").trim() || undefined,
        hp: (r[mapping.hp] || "").trim() || undefined,
        volts: (r[mapping.volts] || "").trim() || undefined,
        rpm: (r[mapping.rpm] || "").trim() || undefined,
        frame: (r[mapping.frame] || "").trim() || undefined,
        criticality,
        status: "operational",
        notes: (r[mapping.notes] || "").trim() || undefined,
      };
    })
    .filter(Boolean) as ParsedAssetRow[];
}

/**
 * Downloads a ready-to-use CSV template for company asset uploads.
 */
export function downloadSampleAssetCsv() {
  const headers = [
    "Asset Name",
    "Tag Number",
    "Equipment Class",
    "Make",
    "Model",
    "Serial Number",
    "Location",
    "Building",
    "Horsepower",
    "Voltage",
    "RPM",
    "Criticality",
    "Notes",
  ];

  const sampleRows = [
    [
      "Influent Pump #1",
      "PMP-101",
      "PMP",
      "Flygt",
      "NP 3153",
      "FL-889421",
      "Wet Well Bay 1",
      "Headworks",
      "25 HP",
      "460V",
      "1750",
      "high",
      "Primary raw influent submersible pump with dual mechanical seals",
    ],
    [
      "Aeration Blower Motor #2",
      "BLW-202-M",
      "MOT",
      "Baldor-Reliance",
      "ECP84400T-4",
      "BD-40912A",
      "Blower Room B",
      "Aeration",
      "100 HP",
      "460V",
      "3550",
      "high",
      "Direct-drive high efficiency motor on duty cycle",
    ],
    [
      "Primary Clarifier Drive #1",
      "CLR-301",
      "PEQ",
      "Ovivo",
      "D-40 Drive Unit",
      "OV-22019",
      "Basin 1 Center Pier",
      "Primary Clarifiers",
      "5 HP",
      "460V",
      "1200",
      "medium",
      "Center-pier helical gear drive with torque overload alarm",
    ],
    [
      "Disinfection UV Channel Bank A",
      "UV-401-A",
      "PEQ",
      "TrojanUV",
      "Signet 60+",
      "TR-90144",
      "UV Disinfection Channel",
      "Disinfection / UV",
      "",
      "240V",
      "",
      "high",
      "40 lamp module with automatic quartz sleeve wiper system",
    ],
    [
      "Centrifuge Sludge Feed Pump #1",
      "PMP-501",
      "PMP",
      "Seepex",
      "BN 35-6L",
      "SP-331002",
      "Dewatering Building",
      "Solids Handling",
      "15 HP",
      "460V",
      "1150",
      "high",
      "Progressive cavity pump with VFD control and run-dry protection",
    ],
  ];

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [
      headers.join(","),
      ...sampleRows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "AssetCareConnect_Asset_Import_Template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Bulk inserts assets into database with progress notification.
 */
export async function bulkInsertAssets(
  assets: ParsedAssetRow[],
  options: {
    generatePmSchedules?: boolean;
    onProgress?: (progress: number, total: number) => void;
  } = {},
): Promise<{ inserted: number; pmsCreated: number }> {
  const BATCH_SIZE = 25;
  let totalInserted = 0;
  let totalPms = 0;

  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);

    const { data: insertedAssets, error } = await supabase
      .from("assets")
      .insert(
        batch.map((a) => ({
          name: a.name,
          tag_number: a.tag_number || null,
          class: a.class || "PEQ",
          make: a.make || null,
          model: a.model || null,
          serial_number: a.serial_number || null,
          location_name: a.location_name || null,
          building: a.building || "Other / Unassigned",
          manufacturer: a.manufacturer || null,
          supplier: a.supplier || null,
          hp: a.hp || null,
          volts: a.volts || null,
          rpm: a.rpm || null,
          frame: a.frame || null,
          criticality: a.criticality || "medium",
          status: a.status || "operational",
          notes: a.notes || null,
        })),
      )
      .select("id, name, class, building");

    if (error) {
      console.error("Batch asset insert error:", error);
      throw error;
    }

    totalInserted += insertedAssets?.length || 0;

    // Optional Auto PM creation for imported assets
    if (options.generatePmSchedules && insertedAssets && insertedAssets.length > 0) {
      const pmRows = [];
      const today = new Date().toISOString().slice(0, 10);
      const nextQuarter = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

      for (const item of insertedAssets) {
        if (item.class === "PMP" || item.class === "MOT") {
          pmRows.push({
            asset_id: item.id,
            title: `Quarterly Lubrication & Vibration Inspection — ${item.name}`,
            description:
              "Check bearing temperatures, inspect mechanical seals for leakage, verify vibration within limits, and apply specified grease.",
            frequency_days: 90,
            due_date: nextQuarter,
            building: item.building,
            priority: "medium",
          });
        } else {
          pmRows.push({
            asset_id: item.id,
            title: `Preventive Maintenance & Safety Check — ${item.name}`,
            description:
              "Perform routine operational inspection, check electrical connections, inspect mounting hardware, and record nameplate parameters.",
            frequency_days: 180,
            due_date: nextQuarter,
            building: item.building,
            priority: "medium",
          });
        }
      }

      if (pmRows.length > 0) {
        const { data: insertedPms, error: pmError } = await supabase
          .from("pm_schedules")
          .insert(pmRows)
          .select("id");
        if (!pmError && insertedPms) {
          totalPms += insertedPms.length;
        }
      }
    }

    if (options.onProgress) {
      options.onProgress(Math.min(i + BATCH_SIZE, assets.length), assets.length);
    }
  }

  return { inserted: totalInserted, pmsCreated: totalPms };
}
