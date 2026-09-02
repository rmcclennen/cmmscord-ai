import { supabase } from "@/integrations/supabase/client";
import { buildingOf } from "@/lib/cmms";

export interface ParsedPartRow {
  name: string;
  part_number?: undefined | string;
  manufacturer?: undefined | string;
  unit_cost?: undefined | number;
  qty_on_hand?: undefined | number;
  unit?: undefined | string;
  notes?: undefined | string;
}

export interface ParsedAssetRow {
  name: string;
  tag_number?: undefined | string;
  class?: undefined | string;
  make?: undefined | string;
  model?: undefined | string;
  serial_number?: undefined | string;
  location_name?: undefined | string;
  building?: undefined | string;
  manufacturer?: undefined | string;
  supplier?: undefined | string;
  hp?: undefined | string;
  volts?: undefined | string;
  rpm?: undefined | string;
  frame?: undefined | string;
  criticality?: undefined | "low" | "medium" | "high";
  status?: undefined | string;
  notes?: undefined | string;
  category?: undefined | string;
  parts?: undefined | ParsedPartRow[];
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
    { key: "location_name", label: "Location / Room (Optional)" },
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

  const headers = parseLine(lines[0] ?? "");
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i] ?? "");
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
 * Parses raw text from documents, CSV, TSV, or tab-indented hierarchical lists.
 * Supports:
 * 1. Standard CSV / TSV with headers.
 * 2. Hierarchical tabbed text where root lines are Assets and indented lines are Parts.
 */
export function parseDocumentText(text: string): {
  isHierarchical: boolean;
  headers: string[];
  rows: Record<string, string>[];
  hierarchicalAssets: ParsedAssetRow[];
} {
  const rawLines = text.split(/\r?\n/);
  const nonEmptyLines = rawLines.filter((l) => l.trim().length > 0);

  if (nonEmptyLines.length === 0) {
    return { isHierarchical: false, headers: [], rows: [], hierarchicalAssets: [] };
  }

  // Check if text is indented hierarchical structure (e.g. lines starting with \t or 2+ spaces or bullet)
  let hasIndentedLines = false;
  for (const line of nonEmptyLines) {
    if (/^(\t|\s{2,}|-\s+|\*\s+)/.test(line)) {
      hasIndentedLines = true;
      break;
    }
  }

  // Also check if any header or line has "Parent" or "Part" structure
  const firstLine = nonEmptyLines[0] || "";
  const isCsvWithCommaOrTab =
    (firstLine.includes(",") || firstLine.includes("\t")) && !hasIndentedLines;

  if (hasIndentedLines) {
    // Parse hierarchical lines
    const parsedAssets: ParsedAssetRow[] = [];
    let currentAsset: ParsedAssetRow | null = null;

    for (const rawLine of rawLines) {
      if (!rawLine.trim()) continue;

      const isIndented = /^(\t|\s{2,}|\s*[-*•]\s+)/.test(rawLine);
      const cleanContent = rawLine.replace(/^[\t\s*-•]+/, "").trim();

      if (!cleanContent) continue;

      if (!isIndented) {
        // This is an Asset line
        // E.g., "Grit Pump #1 - Hayward Gordon - CR4-8" or "010002 - Grit Pump #2 (West)"
        const segments = cleanContent
          .split(/[\t,|;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const rawName = segments[0] || cleanContent;
        const name = stripShelfLocation(rawName) || rawName;

        let tag_number: string | undefined;
        let make: string | undefined;
        let model: string | undefined;
        let cls = "PEQ";

        // Try extracting tag number if present
        const tagMatch = cleanContent.match(/\[([A-Z0-9_-]+)\]|\bTag:\s*([A-Z0-9_-]+)/i);
        if (tagMatch) tag_number = tagMatch[1] || tagMatch[2];

        // Classify equipment
        const upper = cleanContent.toUpperCase();
        if (/PUMP|PMP/.test(upper)) cls = "PMP";
        else if (/MOTOR|MOT/.test(upper)) cls = "MOT";
        else if (/BLOWER|BLW|FAN|HVAC/.test(upper)) cls = "HVAC";
        else if (/MIXER|MIX/.test(upper)) cls = "MIX";
        else if (/DRIVE|CLARIFIER|PEQ|SCREEN/.test(upper)) cls = "PEQ";
        else if (/ELEC|PANEL|ELD|DISCONNECT/.test(upper)) cls = "ELD";
        else if (/VALVE|ACTUATOR/.test(upper)) cls = "VLV";

        if (segments.length >= 2 && !make) make = segments[1];
        if (segments.length >= 3 && !model) model = segments[2];

        currentAsset = {
          name,
          tag_number,
          class: cls,
          make,
          model,
          manufacturer: make,
          building: buildingOf(name, null, null),
          criticality: "medium",
          status: "operational",
          parts: [],
        };
        parsedAssets.push(currentAsset!);
      } else {
        // This is a Part for the preceding asset!
        // E.g. "Chopper Impeller | Part#: VP-IMP-SE4L | Mfr: Vaughan | Qty: 2 | Cost: $1450"
        if (!currentAsset) {
          // If no parent asset yet, create a default equipment unit
          currentAsset = {
            name: "Plant Machinery Unit",
            class: "PEQ",
            building: "Main Process Area",
            criticality: "medium",
            status: "operational",
            parts: [],
          };
          parsedAssets.push(currentAsset);
        }

        const segments = cleanContent
          .split(/[\t,|;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        let partName = segments[0] || cleanContent;
        let partNumber: string | undefined;
        let manufacturer: string | undefined = currentAsset.make || currentAsset.manufacturer;
        let unit_cost: number | undefined;
        let qty_on_hand: number | undefined = 1;

        // Parse key-value tokens in part line
        for (const seg of segments) {
          const pMatch = seg.match(
            /(?:part\s*(?:#|no|number)?|sku|pn)\s*[:=]?\s*([A-Za-z0-9_-]+)/i,
          );
          if (pMatch) partNumber = pMatch[1] ?? undefined;

          const mfrMatch = seg.match(
            /(?:mfr|make|manufacturer|brand)\s*[:=]?\s*([A-Za-z0-9_ -]+)/i,
          );
          if (mfrMatch) manufacturer = mfrMatch[1]?.trim() ?? manufacturer;

          const qtyMatch = seg.match(/(?:qty|quantity|count|stock|on hand)\s*[:=]?\s*(\d+)/i);
          if (qtyMatch) qty_on_hand = parseInt(qtyMatch[1] ?? "1", 10);

          const costMatch = seg.match(/(?:cost|price|\$)\s*[:=]?\s*\$?([\d,]+(?:\.\d{2})?)/i);
          if (costMatch) unit_cost = parseFloat((costMatch[1] ?? "0").replace(/,/g, ""));
        }

        // Clean part name if it has prefixes
        partName = partName
          .replace(/^(?:part\s*(?:#|no)?[:\s-]*|item[:\s-]*)/i, "")
          .replace(/\[.*?\]|\(.*?\)/g, (m) => {
            if (/part|sku|qty|mfr/i.test(m)) return "";
            return m;
          })
          .trim();

        currentAsset.parts = currentAsset.parts || [];
        currentAsset.parts.push({
          name: partName,
          part_number: partNumber,
          manufacturer,
          unit_cost,
          qty_on_hand,
        });
      }
    }

    return {
      isHierarchical: true,
      headers: ["Asset Name", "Tag", "Class", "Parts Count"],
      rows: parsedAssets.map((a) => ({
        "Asset Name": a.name,
        Tag: a.tag_number || "",
        Class: a.class || "PEQ",
        "Parts Count": `${a.parts?.length || 0} parts`,
      })),
      hierarchicalAssets: parsedAssets,
    };
  }

  // Fallback to standard CSV parsing
  const standard = parseCsvText(text);
  return {
    isHierarchical: false,
    headers: standard.headers,
    rows: standard.rows,
    hierarchicalAssets: [],
  };
}

/**
 * Strips shelf and bin location codes (e.g., "1A3", "1B4", "Ph2-1", "1A13B", "1A10 and 1B4")
 * from location names, equipment names, and notes as per plant preference.
 */
export function stripShelfLocation(text: string | null | undefined): string {
  if (!text) return "";
  const cleaned = text
    // Replace phrases like "and 1B4" or ", 1A3"
    .replace(
      /(?:,\s*|\band\s*|\s*&\s*|\s*-\s*|\s*\/\s*)?(?:(?:Ph|Phase)\s*\d+-\d+|1[AB]\d{1,2}[A-Za-z]?)(?:\s*\*+|\s*Supplement)?/gi,
      "",
    )
    // Clean up leftover leading/trailing commas, slashes, dashes, whitespace
    .replace(/^[\s,;/-]+|[\s,;/-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
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
      const rawName = (r[mapping.name] || "").trim();
      const name = stripShelfLocation(rawName) || rawName;
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

      const rawLoc = (r[mapping.location_name] || "").trim();
      const location_name = stripShelfLocation(rawLoc) || undefined;
      const rawBuilding = (r[mapping.building] || "").trim();
      const buildingExplicit = stripShelfLocation(rawBuilding) || undefined;
      const computedBuilding = buildingOf(name, null, location_name, buildingExplicit);

      const rawNotes = (r[mapping.notes] || "").trim();
      const notes = stripShelfLocation(rawNotes) || undefined;

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
        notes,
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
 * Downloads a hierarchical tabbed template where parts are nested under each asset.
 */
export function downloadSampleHierarchicalDoc() {
  const textContent = `Grit Pump #1\tTag: HD-GTP-140\tHayward Gordon\tCR4-8\tHeadworks
\tChopper Impeller\tPart#: VP-IMP-SE4L\tMfr: Hayward Gordon\tQty: 2\tCost: 1450
\tMechanical Seal Assembly\tPart#: VP-SEAL-4L\tMfr: Hayward Gordon\tQty: 2\tCost: 920
\tCutter Bar Plate\tPart#: VP-CB-089\tMfr: Hayward Gordon\tQty: 1\tCost: 680
RDT Feed Pump #1 (WAS)\tTag: WAS-P-845-10\tHayward Gordon\tXCS4A-VDP\tSecondary Settling
\tVortex Impeller\tPart#: HG-IMP-XCS4\tMfr: Hayward Gordon\tQty: 1\tCost: 1250
\tTungsten Carbide Seal Kit\tPart#: HG-SEAL-TC\tMfr: John Crane\tQty: 2\tCost: 780
Digested Sludge Pump #1\tTag: ADW-BFP-381\tVogelsang\tVX186-184-H4Q\tSolids Dewatering
\tHiFlo Rubber Coated Lobes\tPart#: VOG-LOBE-186\tMfr: Vogelsang\tQty: 4\tCost: 890
\tFront Wear Plates\tPart#: VOG-WP-186\tMfr: Vogelsang\tQty: 2\tCost: 420
\tMechanical Cartridge Seal\tPart#: VOG-SEAL-186\tMfr: Vogelsang\tQty: 2\tCost: 650
Sodium Hypochlorite Feed Pump #1\tBlue-White\tM-324-MNKL\tDisinfection
\tPeristaltic Pump Tube Assembly\tPart#: BW-TUBE-M3\tMfr: Blue-White\tQty: 6\tCost: 85
\tRoller Assembly Kit\tPart#: BW-ROLL-M3\tMfr: Blue-White\tQty: 2\tCost: 140
UV Disinfection Channel Bank A\tTag: UV-DIS-01\tTrojanUV\tSignet 60+\tUV Complex
\tLow-Pressure High-Output UV Lamps\tPart#: TR-LAMP-3000\tMfr: TrojanUV\tQty: 40\tCost: 165
\tHigh-Purity Quartz Sleeves\tPart#: TR-SLV-3000\tMfr: TrojanUV\tQty: 40\tCost: 95
\tAutomatic Wiper Rings\tPart#: TR-WIP-3000\tMfr: TrojanUV\tQty: 40\tCost: 42`;

  const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Plant_Assets_With_Parts_Tabbed_Template.txt");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Completely clears all assets and their linked part relations from the database.
 */
export async function clearAllAssetsDatabase(): Promise<{
  deletedAssets: number;
  deletedLinks: number;
}> {
  // Delete all junction links first
  const { data: delLinks, error: linkErr } = await supabase
    .from("part_assets")
    .delete()
    .neq("asset_id", "00000000-0000-0000-0000-000000000000")
    .select("asset_id");

  if (linkErr) console.warn("Delete part_assets notice:", linkErr);

  // Delete all assets
  const { data: delAssets, error: assetErr } = await supabase
    .from("assets")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");

  if (assetErr) {
    console.error("Delete assets error:", assetErr);
    throw assetErr;
  }

  return {
    deletedAssets: delAssets?.length || 0,
    deletedLinks: delLinks?.length || 0,
  };
}

/**
 * Bulk inserts assets (and their nested tabbed parts if provided) into database.
 */
export async function bulkInsertAssets(
  assets: ParsedAssetRow[],
  options: {
    cleanReset?: boolean;
    generatePmSchedules?: boolean;
    onProgress?: (progress: number, total: number) => void;
  } = {},
): Promise<{ inserted: number; partsLinked: number; pmsCreated: number }> {
  if (options.cleanReset) {
    await clearAllAssetsDatabase();
  }

  const BATCH_SIZE = 25;
  let totalInserted = 0;
  let totalPartsLinked = 0;
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
      .select("id, name, class, building, make, model, manufacturer");

    if (error) {
      console.error("Batch asset insert error:", error);
      throw error;
    }

    totalInserted += insertedAssets?.length || 0;

    // Link tabbed parts for each inserted asset
    if (insertedAssets && insertedAssets.length > 0) {
      for (let j = 0; j < insertedAssets.length; j++) {
        const dbAsset = insertedAssets[j];
        const parsedAsset = batch[j];
        if (!dbAsset) continue;

        if (parsedAsset?.parts && parsedAsset.parts.length > 0) {
          for (const p of parsedAsset.parts) {
            if (!p.name.trim()) continue;

            // Check if part already exists in catalog or insert new
            let partId: string | null = null;
            const { data: existingPart } = await supabase
              .from("parts")
              .select("id")
              .ilike("name", p.name.trim())
              .maybeSingle();

            if (existingPart) {
              partId = existingPart.id;
            } else {
              const { data: newPart, error: pErr } = await supabase
                .from("parts")
                .insert({
                  name: p.name.trim(),
                  part_number: p.part_number || null,
                  manufacturer: p.manufacturer || dbAsset.manufacturer || dbAsset.make || null,
                  unit_cost: p.unit_cost || null,
                  qty_on_hand: p.qty_on_hand ?? 1,
                  min_qty: 1,
                  unit: p.unit || "EA",
                  location: "Warehouse Central Storage",
                })
                .select("id")
                .single();

              if (!pErr && newPart) {
                partId = newPart.id;
              }
            }

            if (partId) {
              const { error: linkError } = await supabase.from("part_assets").upsert(
                {
                  asset_id: dbAsset.id,
                  part_id: partId,
                },
                { onConflict: "part_id,asset_id" },
              );

              if (!linkError) {
                totalPartsLinked++;
              }
            }
          }
        }
      }
    }

    // Optional Auto PM creation for imported assets
    if (options.generatePmSchedules && insertedAssets && insertedAssets.length > 0) {
      const pmRows = [];
      const nextQuarter = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const nextSemiAnnual = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);

      for (const item of insertedAssets) {
        if (item.class === "PMP" || item.class === "MOT") {
          pmRows.push({
            asset_id: item.id,
            title: `Quarterly Lubrication & Vibration Inspection — ${item.name}`,
            tasks:
              "Check bearing temperatures, inspect mechanical seals for leakage, verify vibration within limits, and apply specified grease.",
            interval_days: 90,
            next_due: nextQuarter,
            priority: "medium",
            active: true,
          });
        } else {
          pmRows.push({
            asset_id: item.id,
            title: `Preventive Maintenance & Safety Check — ${item.name}`,
            tasks:
              "Perform routine operational inspection, check electrical connections, inspect mounting hardware, and record nameplate parameters.",
            interval_days: 180,
            next_due: nextSemiAnnual,
            priority: "medium",
            active: true,
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

  return { inserted: totalInserted, partsLinked: totalPartsLinked, pmsCreated: totalPms };
}
