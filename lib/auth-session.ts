import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { CurrentUserSummary } from "@/data/backend-user-data";
import {
  getPlatformAccessibleGigIdsForTemporaryManagerStaffProfile,
} from "@/lib/gig-store";
import {
  decodeSignedSessionCookie,
  encodeSignedSessionCookie,
  isSessionCookieConfigurationAvailable,
} from "@/lib/session-cookie";
import { getStoredScmStaffProfileById } from "@/lib/scm-staff-store";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import { getScmRoleDefinition, type ScmStaffRoleKey, type StoredScmStaffProfile } from "@/types/scm-rbac";

const sessionCookieName = "scm_auth_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;
const sessionMaxAgeMs = sessionMaxAgeSeconds * 1000;

type StoredAuthSession = {
  subjectType?: "scmStaff" | "temporaryGigManager";
  profileId?: string;
  linkedStaffProfileId?: string;
  createdAt: string;
};

type AuthSessionTarget =
  | {
      subjectType: "scmStaff";
      profileId: string;
    }
  | {
      subjectType: "temporaryGigManager";
      linkedStaffProfileId: string;
    };

function normalizeStoredAuthSession(session: StoredAuthSession): StoredAuthSession {
  if (session.subjectType) {
    return session;
  }

  return {
    ...session,
    subjectType: "scmStaff",
  };
}

function isStoredAuthSessionFresh(session: StoredAuthSession) {
  const createdAt = new Date(session.createdAt).getTime();

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  return Date.now() - createdAt <= sessionMaxAgeMs;
}

function getDisplayInitials(displayName: string) {
  return displayName
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function resolvePlatformTemporaryGigManagerProfile(linkedStaffProfileId: string) {
  const [staffProfile, activeGigIds] = await Promise.all([
    getStoredStaffProfileById(linkedStaffProfileId),
    getPlatformAccessibleGigIdsForTemporaryManagerStaffProfile(linkedStaffProfileId),
  ]);

  if (!staffProfile || activeGigIds.length === 0) {
    return null;
  }

  return {
    id: `temporary-gig-manager-${staffProfile.id}`,
    displayName: staffProfile.displayName,
    email: staffProfile.email,
    passwordHash: "",
    phone: staffProfile.phone,
    roleKey: "temporaryGigManager" as const,
    country: staffProfile.country,
    regions: staffProfile.regions ?? [staffProfile.region].filter(Boolean),
    assignedGigIds: activeGigIds,
    linkedStaffId: staffProfile.id,
    linkedStaffName: staffProfile.displayName,
    profileImageName: staffProfile.profileImageName,
    profileImageUrl: staffProfile.profileImageUrl,
    notes: "Temporary gig manager access shared from the staff directory.",
  } satisfies StoredScmStaffProfile;
}

export async function createAuthSession(target: string | AuthSessionTarget) {
  const cookieStore = await cookies();

  if (!isSessionCookieConfigurationAvailable()) {
    cookieStore.delete(sessionCookieName);
    return null;
  }

  const sessionTarget: AuthSessionTarget =
    typeof target === "string"
      ? {
          subjectType: "scmStaff",
          profileId: target,
        }
      : target;
  const session: StoredAuthSession =
    sessionTarget.subjectType === "temporaryGigManager"
      ? {
          subjectType: sessionTarget.subjectType,
          linkedStaffProfileId: sessionTarget.linkedStaffProfileId,
          createdAt: new Date().toISOString(),
        }
      : {
          subjectType: sessionTarget.subjectType,
          profileId: sessionTarget.profileId,
          createdAt: new Date().toISOString(),
        };

  cookieStore.set(sessionCookieName, encodeSignedSessionCookie(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });

  return session;
}

export async function destroyCurrentAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function getCurrentAuthSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    return null;
  }

  if (!isSessionCookieConfigurationAvailable()) {
    cookieStore.delete(sessionCookieName);
    return null;
  }

  const session = decodeSignedSessionCookie<StoredAuthSession>(sessionToken);

  if (!session) {
    return null;
  }

  const normalizedSession = normalizeStoredAuthSession(session);

  if (!isStoredAuthSessionFresh(normalizedSession)) {
    cookieStore.delete(sessionCookieName);
    return null;
  }

  return normalizedSession;
}

export async function getCurrentAuthenticatedScmStaffProfile() {
  const session = await getCurrentAuthSession();

  if (!session) {
    return null;
  }

  if (session.subjectType === "temporaryGigManager") {
    const linkedStaffProfileId = session.linkedStaffProfileId?.trim() ?? "";

    if (!linkedStaffProfileId) {
      return null;
    }

    return resolvePlatformTemporaryGigManagerProfile(linkedStaffProfileId);
  }

  const profileId = session.profileId?.trim() ?? "";

  if (!profileId) {
    return null;
  }

  const storedProfile = await getStoredScmStaffProfileById(profileId);

  if (!storedProfile) {
    return null;
  }

  if (storedProfile.roleKey === "temporaryGigManager") {
    return null;
  }

  return storedProfile;
}

export async function requireCurrentAuthenticatedScmStaffProfile() {
  const profile = await getCurrentAuthenticatedScmStaffProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function getCurrentAuthenticatedUserSummary(): Promise<
  (CurrentUserSummary & {
    roleKey: ScmStaffRoleKey;
    profileImageUrl?: string;
  }) | null
> {
  const profile = await getCurrentAuthenticatedScmStaffProfile();

  if (!profile) {
    return null;
  }

  return createUserSummaryFromScmProfile(profile);
}

export function createUserSummaryFromScmProfile(profile: StoredScmStaffProfile) {
  const displayName = profile.displayName.trim();

  return {
    id: profile.id,
    email: profile.email,
    displayName,
    initials: getDisplayInitials(displayName),
    roleKey: profile.roleKey,
    roleLabel: getScmRoleDefinition(profile.roleKey).label,
    profileImageUrl: profile.profileImageUrl?.trim() ?? "",
  };
}

export function canAccessScmStaffAdministration(roleKey: ScmStaffRoleKey) {
  return roleKey === "superAdmin" || roleKey === "officeStaff";
}

export function canAccessScmStaffDirectory(roleKey: ScmStaffRoleKey) {
  return (
    roleKey === "superAdmin" ||
    roleKey === "officeStaff" ||
    roleKey === "regionalManager"
  );
}

export function isSuperAdminRole(roleKey: ScmStaffRoleKey) {
  return roleKey === "superAdmin";
}

export async function requireScmStaffAdministrationProfile() {
  const profile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!canAccessScmStaffAdministration(profile.roleKey)) {
    redirect("/dashboard");
  }

  return profile;
}

export async function requireScmStaffDirectoryProfile() {
  const profile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!canAccessScmStaffDirectory(profile.roleKey)) {
    redirect("/dashboard");
  }

  return profile;
}

export async function requireSuperAdminProfile() {
  const profile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!isSuperAdminRole(profile.roleKey)) {
    redirect("/dashboard");
  }

  return profile;
}
