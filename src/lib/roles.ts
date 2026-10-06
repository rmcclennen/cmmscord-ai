import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/** Plant job roles, ordered from most to least authority. */
export const ROLE_OPTIONS: { value: AppRole; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Full system access" },
  { value: "manager", label: "Manager", hint: "Approves deletions, assigns roles" },
  { value: "supervisor", label: "Supervisor", hint: "Approves deletions" },
  { value: "lead_operator", label: "Lead Operator", hint: "Runs the shift" },
  { value: "operator", label: "Operator", hint: "Process operations" },
  { value: "electrician", label: "Electrician", hint: "Electrical work" },
  { value: "maintenance", label: "Maintenance", hint: "Mechanical work" },
  { value: "technician", label: "Technician", hint: "General technician" },
  { value: "viewer", label: "Viewer", hint: "Read only" },
];

const LABELS = new Map(ROLE_OPTIONS.map((r) => [r.value, r.label]));

export function roleLabel(role: AppRole | string) {
  return LABELS.get(role as AppRole) ?? String(role).replace(/_/g, " ");
}

/** Roles allowed to approve or deny deletion requests. */
export const APPROVER_ROLES: AppRole[] = ["admin", "manager", "supervisor"];

export function canApproveDeletions(roles: AppRole[]) {
  return roles.some((r) => APPROVER_ROLES.includes(r));
}

export function canManageRoles(roles: AppRole[]) {
  return roles.includes("admin") || roles.includes("manager");
}

export type DeletableEntity = "asset" | "pm_schedule" | "work_order";

export const ENTITY_LABELS: Record<DeletableEntity, string> = {
  asset: "Asset",
  pm_schedule: "PM schedule",
  work_order: "Work order",
};
