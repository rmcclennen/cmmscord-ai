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
