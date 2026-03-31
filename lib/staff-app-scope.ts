import type {
  StaffAppLevel,
  StaffAppRole,
  StaffAppRoleScope,
  StaffAppScopeRole,
} from "@/types/staff-app";
import { staffRoleKeys, type StoredStaffRoleProfiles } from "@/types/staff-role";

function clampStaffAppLevel(priority: number): StaffAppLevel {
  if (!Number.isFinite(priority)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(priority))) as StaffAppLevel;
}

export function deriveStaffAppRoleScopesFromRoleProfiles(
  roleProfiles: Partial<StoredStaffRoleProfiles> | undefined,
  fallbackRoles: string[] = [],
  fallbackPriority = 3,
) {
  const roleScopesFromProfiles = staffRoleKeys
    .filter((roleKey) => roleProfiles?.[roleKey]?.enabled)
    .map<StaffAppRoleScope>((roleKey) => ({
      role: roleKey as StaffAppScopeRole,
      level: clampStaffAppLevel(roleProfiles?.[roleKey]?.priority ?? fallbackPriority),
    }));

  if (roleScopesFromProfiles.length > 0) {
    return roleScopesFromProfiles;
  }

  return fallbackRoles
    .filter((role): role is StaffAppScopeRole => staffRoleKeys.includes(role as StaffAppScopeRole))
    .map((role) => ({
      role,
      level: clampStaffAppLevel(fallbackPriority),
    }));
}

export function deriveStaffAppApprovedRoles(roleScopes: StaffAppRoleScope[]) {
  return roleScopes
    .map((scope) => scope.role)
    .filter((role): role is StaffAppScopeRole => Boolean(role));
}

export function getStaffAppLevelForRole(
  roleScopes: StaffAppRoleScope[],
  role: StaffAppRole,
) {
  return roleScopes.find((scope) => scope.role === role)?.level ?? null;
}

export function formatStaffAppScopeLabel(roleScopes: StaffAppRoleScope[]) {
  if (roleScopes.length === 0) {
    return "No mobile pass access";
  }

  return roleScopes.map((scope) => `${scope.role} L${scope.level}`).join(" / ");
}

export function formatStaffAppApprovedRolesLabel(roleScopes: StaffAppRoleScope[]) {
  if (roleScopes.length === 0) {
    return "No approved roles";
  }

  return roleScopes.map((scope) => scope.role).join(" / ");
}
