import type { AppRole } from "./roles";

/**
 * Who may change whom. These mirror the row-level-security rules in the database
 * ("Admins manage roles" / "Managers manage non-admin non-supervisor roles") so the
 * server functions that use the service-role key enforce the same limits.
 */

export function canManageUsers(roles: readonly AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("manager");
}

/** May `actor` grant or revoke `role` for the user `targetUserId`? */
export function canAssignRole(
  actorRoles: readonly AppRole[],
  role: AppRole | string,
  targetUserId: string,
  actorUserId: string,
): boolean {
  if (actorRoles.includes("admin")) return true;
  if (actorRoles.includes("manager")) {
    // Managers can't touch the top roles or their own access.
    return role !== "admin" && role !== "supervisor" && targetUserId !== actorUserId;
  }
  return false;
}

/** May `actor` delete the account of `targetUserId` (who holds `targetRoles`)? */
export function canDeleteUser(
  actorRoles: readonly AppRole[],
  targetRoles: readonly AppRole[],
  targetUserId: string,
  actorUserId: string,
): boolean {
  if (targetUserId === actorUserId) return false;
  if (actorRoles.includes("admin")) return true;
  if (actorRoles.includes("manager")) {
    return !targetRoles.some((r) => r === "admin" || r === "manager" || r === "supervisor");
  }
  return false;
}

/** May `actor` edit the contact details of `targetUserId`? */
export function canEditProfile(
  actorRoles: readonly AppRole[],
  targetUserId: string,
  actorUserId: string,
): boolean {
  return targetUserId === actorUserId || canManageUsers(actorRoles);
}
