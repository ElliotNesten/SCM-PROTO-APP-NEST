import type { StoredStaffProfile } from "@/lib/staff-store";
import type { Gig } from "@/types/scm";
import type { ScmStaffRoleKey, StoredScmStaffProfile } from "@/types/scm-rbac";

type PlatformAccessProfile =
  | Pick<StoredScmStaffProfile, "roleKey" | "assignedGigIds">
  | null
  | undefined;

type PlatformFieldStaffScopeProfile =
  | Pick<StoredScmStaffProfile, "roleKey" | "country" | "regions">
  | null
  | undefined;

type PlatformFieldStaffScopeTarget =
  | Pick<StoredStaffProfile, "approvalStatus" | "country" | "region" | "regions">
  | null
  | undefined;

function isTemporaryGigManagerRole(roleKey: ScmStaffRoleKey | undefined) {
  return roleKey === "temporaryGigManager";
}

function normalizeScopeValue(value: string) {
  return value.trim().toLowerCase();
}

function matchesPlatformScopeRegions(profileRegions: string[], scopeValues: string[]) {
  if (profileRegions.length === 0) {
    return true;
  }

  const normalizedValues = scopeValues.map(normalizeScopeValue).filter(Boolean);

  return profileRegions.some((region) =>
    normalizedValues.includes(normalizeScopeValue(region)),
  );
}

export function isTemporaryGigManagerProfile(profile: PlatformAccessProfile) {
  return isTemporaryGigManagerRole(profile?.roleKey);
}

export function canAccessPlatformGig(
  profile: PlatformAccessProfile,
  gig: Pick<Gig, "id"> | null | undefined,
) {
  if (!gig) {
    return false;
  }

  if (!isTemporaryGigManagerProfile(profile)) {
    return true;
  }

  return (profile?.assignedGigIds ?? []).includes(gig.id);
}

export function filterPlatformGigsForProfile<T extends Pick<Gig, "id">>(
  gigs: T[],
  profile: PlatformAccessProfile,
) {
  if (!isTemporaryGigManagerProfile(profile)) {
    return gigs;
  }

  const allowedGigIds = new Set(profile?.assignedGigIds ?? []);
  return gigs.filter((gig) => allowedGigIds.has(gig.id));
}

export function canManageGigShare(roleKey: ScmStaffRoleKey | undefined) {
  return (
    roleKey === "superAdmin" ||
    roleKey === "officeStaff" ||
    roleKey === "regionalManager"
  );
}

export function canCreatePlatformGigs(roleKey: ScmStaffRoleKey | undefined) {
  return !isTemporaryGigManagerRole(roleKey);
}

export function canAccessPlatformStaffDirectory(roleKey: ScmStaffRoleKey | undefined) {
  return !isTemporaryGigManagerRole(roleKey);
}

export function canUsePlatformGlobalSearch(roleKey: ScmStaffRoleKey | undefined) {
  return !isTemporaryGigManagerRole(roleKey);
}

export function canAccessPlatformFieldStaffProfile(
  profile: PlatformFieldStaffScopeProfile,
  staffProfile: PlatformFieldStaffScopeTarget,
) {
  if (!canManagePlatformFieldStaffProfile(profile, staffProfile)) {
    return false;
  }

  return staffProfile?.approvalStatus === "Approved";
}

export function canManagePlatformFieldStaffProfile(
  profile: PlatformFieldStaffScopeProfile,
  staffProfile: PlatformFieldStaffScopeTarget,
) {
  if (!profile || !staffProfile) {
    return false;
  }

  switch (profile.roleKey) {
    case "superAdmin":
    case "officeStaff":
      return true;
    case "regionalManager":
      if (normalizeScopeValue(profile.country) !== normalizeScopeValue(staffProfile.country)) {
        return false;
      }

      return matchesPlatformScopeRegions(profile.regions, [
        staffProfile.region,
        ...(staffProfile.regions ?? []),
      ]);
    case "temporaryGigManager":
      return false;
    default:
      return false;
  }
}
