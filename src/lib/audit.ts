export const AUDIT_TABLES: Array<{ value: string; label: string }> = [
  { value: "assets", label: "Assets" },
  { value: "pm_schedules", label: "PM schedules" },
  { value: "work_orders", label: "Work orders" },
  { value: "parts", label: "Parts" },
  { value: "part_requests", label: "Part requests" },
  { value: "manuals", label: "Manuals" },
  { value: "deletion_requests", label: "Deletion requests" },
  { value: "user_roles", label: "Roles" },
  { value: "company_members", label: "Members" },
];

export const AUDIT_ACTIONS = ["INSERT", "UPDATE", "DELETE"] as const;

/** Turns the stored `changes` json into short "field: old → new" lines. */
export function summarizeChanges(action: string, changes: unknown, maxFields = 6): string[] {
  if (!changes || typeof changes !== "object") return [];
  const entries = Object.entries(changes as Record<string, unknown>);
  const show = (v: unknown) => {
    if (v === null || v === undefined) return "empty";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  };
  const lines = entries.slice(0, maxFields).map(([field, value]) => {
    if (action === "UPDATE" && value && typeof value === "object" && "old" in value) {
      const v = value as { old: unknown; new: unknown };
      return `${field}: ${show(v.old)} → ${show(v.new)}`;
    }
    return `${field}: ${show(value)}`;
  });
  if (entries.length > maxFields) lines.push(`+${entries.length - maxFields} more`);
  return lines;
}
