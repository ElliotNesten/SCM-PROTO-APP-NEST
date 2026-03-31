import type { Gig } from "@/types/scm";
import type { ScmStaffRoleKey, StoredScmStaffProfile } from "@/types/scm-rbac";

type PlatformAccessProfile =
  | Pick<StoredScmStaffProfile, "roleKey" | "assignedGigIds">
  | null
  | undefined;

function isTemporaryGigManagerRole(roleKey: ScmStaffRoleKey | undefined) {
  return roleKey === "temporaryGigManager";
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
