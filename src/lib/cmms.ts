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
  const diff = new Date(date + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime();
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
  ["Solids Handling", /centrifuge|rotary drum thickener|\brdt\b|dewater|sludge cake|silo|schwing|polymer/i],
  ["Digester Complex", /digester|gas |boiler|\bp4\b|methane/i],
  ["Primary Clarifiers", /primary clarifier|primary sludge|scum/i],
  ["Aeration", /aeration|blower|mixer|\bras\b|\bwas\b|diffuser/i],
  ["Final Clarifiers", /final clarifier/i],
  ["Disinfection / UV", /disinfection|\buv\b|trojan|chlorine|contact basin|hypo/i],
  ["Pump Houses", /pump house|wet well|lift station|effluent pump/i],
  ["Administration", /administration|admin building|lab |laboratory|office|maintenance shop|garage/i],
  ["Plant Utilities", /air compressor|air dryer|hvac|make up air|generator|water system|plant water/i],
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

