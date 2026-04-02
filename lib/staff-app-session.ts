import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  decodeSignedSessionCookie,
  encodeSignedSessionCookie,
  isSessionCookieConfigurationAvailable,
} from "@/lib/session-cookie";
import { getStoredScmStaffProfileById } from "@/lib/scm-staff-store";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import {
  getStaffAppAccountById,
  syncStaffAppAccountFromLinkedStaffProfile,
} from "@/lib/staff-app-store";
import type { StaffAppAccount } from "@/types/staff-app";
import type { StoredScmStaffProfile } from "@/types/scm-rbac";

const sessionCookieName = "scm_staff_mobile_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;
const sessionMaxAgeMs = sessionMaxAgeSeconds * 1000;

type StaffAppSessionSubjectType = "staff" | "scmStaff";

type StoredStaffAppSession = {
  subjectType?: StaffAppSessionSubjectType;
  accountId?: string;
  scmStaffProfileId?: string;
  createdAt: string;
};

type StaffAppSessionTarget =
  | {
      subjectType: "staff";
      accountId: string;
    }
  | {
      subjectType: "scmStaff";
      scmStaffProfileId: string;
    };

export type CurrentStaffAppUserContext =
  | {
      appRole: "STAFF";
      account: StaffAppAccount;
    }
  | {
      appRole: "SCM STAFF";
      profile: StoredScmStaffProfile;
    };

function normalizeStoredStaffAppSession(
  session: StoredStaffAppSession,
): StoredStaffAppSession {
  if (session.subjectType === "scmStaff") {
    return {
      ...session,
      subjectType: "scmStaff",
    };
  }

  return {
    ...session,
    subjectType: "staff",
  };
}

function isStoredStaffAppSessionFresh(session: StoredStaffAppSession) {
  const createdAt = new Date(session.createdAt).getTime();

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  return Date.now() - createdAt <= sessionMaxAgeMs;
}

export async function createStaffAppSession(target: string | StaffAppSessionTarget) {
  const cookieStore = await cookies();

  if (!isSessionCookieConfigurationAvailable()) {
    cookieStore.delete(sessionCookieName);
    return null;
  }

  const sessionTarget: StaffAppSessionTarget =
    typeof target === "string"
      ? {
          subjectType: "staff",
          accountId: target,
        }
      : target;
  const session: StoredStaffAppSession =
    sessionTarget.subjectType === "scmStaff"
      ? {
          subjectType: "scmStaff",
          scmStaffProfileId: sessionTarget.scmStaffProfileId,
          createdAt: new Date().toISOString(),
        }
      : {
          subjectType: "staff",
          accountId: sessionTarget.accountId,
          createdAt: new Date().toISOString(),
        };

  cookieStore.set(sessionCookieName, encodeSignedSessionCookie(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function destroyCurrentStaffAppSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function getCurrentStaffAppSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    return null;
  }

  if (!isSessionCookieConfigurationAvailable()) {
    cookieStore.delete(sessionCookieName);
    return null;
  }

  const session = decodeSignedSessionCookie<StoredStaffAppSession>(sessionToken);

  if (!session) {
    return null;
  }

  const normalizedSession = normalizeStoredStaffAppSession(session);

  if (!isStoredStaffAppSessionFresh(normalizedSession)) {
    cookieStore.delete(sessionCookieName);
    return null;
  }

  return normalizedSession;
}

export async function getCurrentStaffAppAccount() {
  const session = await getCurrentStaffAppSession();

  if (!session || session.subjectType !== "staff") {
    return null;
  }

  const accountId = session.accountId?.trim() ?? "";

  if (!accountId) {
    return null;
  }

  const account = await getStaffAppAccountById(accountId);

  if (!account) {
    return null;
  }

  const linkedStaffProfileId = account.linkedStaffProfileId?.trim() ?? "";

  if (!linkedStaffProfileId) {
    return account;
  }

  const linkedProfile = await getStoredStaffProfileById(linkedStaffProfileId);

  if (!linkedProfile) {
    return account;
  }

  return syncStaffAppAccountFromLinkedStaffProfile({
    id: linkedProfile.id,
    displayName: linkedProfile.displayName,
    email: linkedProfile.email,
    phone: linkedProfile.phone,
    country: linkedProfile.country,
    region: linkedProfile.region,
    roleProfiles: linkedProfile.roleProfiles,
    roles: linkedProfile.roles,
    priority: linkedProfile.priority,
    profileImageUrl: linkedProfile.profileImageUrl,
  });
}

export async function getCurrentStaffAppScmProfile() {
  const session = await getCurrentStaffAppSession();

  if (!session || session.subjectType !== "scmStaff") {
    return null;
  }

  const profileId = session.scmStaffProfileId?.trim() ?? "";

  if (!profileId) {
    return null;
  }

  return getStoredScmStaffProfileById(profileId);
}

export async function getCurrentStaffAppUserContext(): Promise<CurrentStaffAppUserContext | null> {
  const session = await getCurrentStaffAppSession();

  if (!session) {
    return null;
  }

  if (session.subjectType === "scmStaff") {
    const profile = await getCurrentStaffAppScmProfile();

    if (!profile) {
      return null;
    }

    return {
      appRole: "SCM STAFF",
      profile,
    };
  }

  const account = await getCurrentStaffAppAccount();

  if (!account) {
    return null;
  }

  return {
    appRole: "STAFF",
    account,
  };
}

export async function getCurrentStaffAppHomePath() {
  const userContext = await getCurrentStaffAppUserContext();

  if (!userContext) {
    return "/staff-app/login";
  }

  if (userContext.appRole === "SCM STAFF") {
    return "/staff-app/scm";
  }

  return userContext.account.mustCompleteOnboarding
    ? "/staff-app/onboarding"
    : "/staff-app/home";
}

export async function requireCurrentStaffAppAccount() {
  const account = await getCurrentStaffAppAccount();

  if (!account) {
    redirect("/staff-app");
  }

  return account;
}

export async function requireCurrentStaffAppScmProfile() {
  const profile = await getCurrentStaffAppScmProfile();

  if (!profile) {
    redirect("/staff-app");
  }

  return profile;
}
