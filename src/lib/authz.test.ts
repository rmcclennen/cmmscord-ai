import { describe, expect, it } from "vitest";
import { canAssignRole, canDeleteUser, canEditProfile, canManageUsers } from "./authz";

const ME = "me";
const OTHER = "other";

describe("canManageUsers", () => {
  it("allows only admins and managers", () => {
    expect(canManageUsers(["admin"])).toBe(true);
    expect(canManageUsers(["manager"])).toBe(true);
    expect(canManageUsers(["supervisor", "technician", "viewer"])).toBe(false);
    expect(canManageUsers([])).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("lets admins assign anything", () => {
    expect(canAssignRole(["admin"], "admin", OTHER, ME)).toBe(true);
    expect(canAssignRole(["admin"], "viewer", ME, ME)).toBe(true);
  });
  it("keeps managers away from admin/supervisor roles and their own access", () => {
    expect(canAssignRole(["manager"], "operator", OTHER, ME)).toBe(true);
    expect(canAssignRole(["manager"], "admin", OTHER, ME)).toBe(false);
    expect(canAssignRole(["manager"], "supervisor", OTHER, ME)).toBe(false);
    expect(canAssignRole(["manager"], "operator", ME, ME)).toBe(false);
  });
  it("denies everyone else, including people with no role", () => {
    expect(canAssignRole(["supervisor"], "operator", OTHER, ME)).toBe(false);
    expect(canAssignRole(["technician"], "admin", ME, ME)).toBe(false);
    expect(canAssignRole(["viewer"], "admin", ME, ME)).toBe(false);
    expect(canAssignRole([], "admin", ME, ME)).toBe(false);
  });
});

describe("canDeleteUser", () => {
  it("never allows deleting yourself", () => {
    expect(canDeleteUser(["admin"], [], ME, ME)).toBe(false);
  });
  it("lets admins delete others", () => {
    expect(canDeleteUser(["admin"], ["admin"], OTHER, ME)).toBe(true);
  });
  it("stops managers deleting senior staff", () => {
    expect(canDeleteUser(["manager"], ["technician"], OTHER, ME)).toBe(true);
    expect(canDeleteUser(["manager"], ["admin"], OTHER, ME)).toBe(false);
    expect(canDeleteUser(["manager"], ["supervisor"], OTHER, ME)).toBe(false);
    expect(canDeleteUser(["manager"], ["manager"], OTHER, ME)).toBe(false);
  });
  it("denies supervisors and role-less users", () => {
    expect(canDeleteUser(["supervisor"], ["viewer"], OTHER, ME)).toBe(false);
    expect(canDeleteUser([], ["viewer"], OTHER, ME)).toBe(false);
  });
});

describe("canEditProfile", () => {
  it("allows self-edit and manager edit only", () => {
    expect(canEditProfile(["viewer"], ME, ME)).toBe(true);
    expect(canEditProfile(["viewer"], OTHER, ME)).toBe(false);
    expect(canEditProfile(["manager"], OTHER, ME)).toBe(true);
  });
});
