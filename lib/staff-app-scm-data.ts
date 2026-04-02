import { getAllStoredGigs } from "@/lib/gig-store";
import { canAccessPlatformFieldStaffProfile } from "@/lib/platform-access";
import { getAllStoredScmStaffProfiles } from "@/lib/scm-staff-store";
import { getAllStoredStaffProfiles } from "@/lib/staff-store";
import type { Gig } from "@/types/scm";
import {
  getRegionalManagerRegionSummary,
  getScmRoleDefinition,
  type StoredScmStaffProfile,
} from "@/types/scm-rbac";

function getTodayInStockholmDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeScopeValue(value: string) {
  return value.trim().toLowerCase();
}

function sortGigsByUpcoming(left: Gig, right: Gig) {
  const leftDate = new Date(`${left.date}T${left.startTime || "00:00"}:00`);
  const rightDate = new Date(`${right.date}T${right.startTime || "00:00"}:00`);
  return leftDate.getTime() - rightDate.getTime();
}

function matchesProfileRegions(profileRegions: string[], scopeValues: string[]) {
  if (profileRegions.length === 0) {
    return true;
  }

  const normalizedValues = scopeValues.map(normalizeScopeValue).filter(Boolean);

  return profileRegions.some((region) =>
    normalizedValues.includes(normalizeScopeValue(region)),
  );
}

function canAccessGig(profile: StoredScmStaffProfile, gig: Gig) {
  switch (profile.roleKey) {
    case "superAdmin":
    case "officeStaff":
      return true;
    case "regionalManager":
      if (normalizeScopeValue(profile.country) !== normalizeScopeValue(gig.country)) {
        return false;
      }

      return matchesProfileRegions(profile.regions, [gig.region, gig.city]);
    case "temporaryGigManager":
      return profile.assignedGigIds.includes(gig.id);
    default:
      return false;
  }
}

function canAccessScmPeer(
  profile: StoredScmStaffProfile,
  peerProfile: StoredScmStaffProfile,
) {
  if (peerProfile.id === profile.id) {
    return false;
  }

  switch (profile.roleKey) {
    case "superAdmin":
    case "officeStaff":
      return true;
    case "regionalManager":
      if (peerProfile.roleKey === "superAdmin" || peerProfile.roleKey === "officeStaff") {
        return true;
      }

      if (normalizeScopeValue(profile.country) !== normalizeScopeValue(peerProfile.country)) {
        return false;
      }

      return matchesProfileRegions(profile.regions, peerProfile.regions);
    case "temporaryGigManager":
      return false;
    default:
      return false;
  }
}

function canAccessScmDirectoryProfile(
  profile: StoredScmStaffProfile,
  candidateProfile: StoredScmStaffProfile,
) {
  if (candidateProfile.id === profile.id) {
    return true;
  }

  return canAccessScmPeer(profile, candidateProfile);
}

export function formatStaffAppScmScopeLabel(profile: StoredScmStaffProfile) {
  if (profile.roleKey === "superAdmin") {
    return "Global access";
  }

  if (profile.roleKey === "officeStaff") {
    return "System-wide admin";
  }

  if (profile.roleKey === "regionalManager") {
    const regionSummary =
      profile.country === "Sweden"
        ? getRegionalManagerRegionSummary(profile.country, profile.regions)
        : profile.regions.join(", ");

    return [profile.country, regionSummary || "Assigned scope"].filter(Boolean).join(" | ");
  }

  return profile.assignedGigIds.length > 0
    ? `${profile.assignedGigIds.length} assigned gigs`
    : "Assigned gigs only";
}

export async function getStaffAppScmData(profile: StoredScmStaffProfile) {
  const [allGigs, allScmProfiles, allFieldStaff] = await Promise.all([
    getAllStoredGigs(),
    getAllStoredScmStaffProfiles(),
    getAllStoredStaffProfiles(),
  ]);
  const today = getTodayInStockholmDate();
  const roleDefinition = getScmRoleDefinition(profile.roleKey);
  const accessibleGigs = allGigs.filter((gig) => canAccessGig(profile, gig)).sort(sortGigsByUpcoming);
  const activeGigs = accessibleGigs.filter(
    (gig) => gig.status !== "Closed" && gig.date >= today,
  );
  const attentionGigs = [...accessibleGigs]
    .filter((gig) => gig.alertCount > 0 || gig.status === "Investigating")
    .sort((left, right) => {
      if (right.alertCount !== left.alertCount) {
        return right.alertCount - left.alertCount;
      }

      return sortGigsByUpcoming(left, right);
    });
  const upcomingGigs = activeGigs.slice(0, 6);
  const closeoutGigs = accessibleGigs.filter(
    (gig) => gig.status === "Completed" || gig.status === "Reported",
  );
  const staffingGapGigs = accessibleGigs.filter((gig) => gig.staffingProgress < 100);
  const fieldStaffProfiles = allFieldStaff
    .filter((staffProfile) => canAccessPlatformFieldStaffProfile(profile, staffProfile))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  const scmDirectoryProfiles = allScmProfiles
    .filter((candidateProfile) => canAccessScmDirectoryProfile(profile, candidateProfile))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  const scmPeers = scmDirectoryProfiles
    .filter((peerProfile) => canAccessScmPeer(profile, peerProfile))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return {
    roleDefinition,
    scopeLabel: formatStaffAppScmScopeLabel(profile),
    accessibleGigs,
    upcomingGigs,
    attentionGigs,
    closeoutGigs,
    staffingGapGigs,
    fieldStaffProfiles,
    scmDirectoryProfiles,
    scmPeers,
    metrics: {
      accessibleGigCount: accessibleGigs.length,
      activeGigCount: activeGigs.length,
      attentionGigCount: attentionGigs.length,
      closeoutGigCount: closeoutGigs.length,
      staffingGapCount: staffingGapGigs.length,
      fieldStaffCount: fieldStaffProfiles.length,
      scmDirectoryCount: scmDirectoryProfiles.length,
      scmPeerCount: scmPeers.length,
    },
  };
}
