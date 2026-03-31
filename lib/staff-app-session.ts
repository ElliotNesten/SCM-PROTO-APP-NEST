import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getStoredScmStaffProfileById } from "@/lib/scm-staff-store";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import {
  getStaffAppAccountById,
  syncStaffAppAccountFromLinkedStaffProfile,
} from "@/lib/staff-app-store";
import type { StaffAppAccount } from "@/types/staff-app";
import type { StoredScmStaffProfile } from "@/types/scm-rbac";

const sessionCookieName = "scm_staff_mobile_session";
const sessionStoreDirectory = path.join(process.cwd(), "data");
const sessionStorePath = path.join(sessionStoreDirectory, "staff-app-sessions.json");

type StaffAppSessionSubjectType = "staff" | "scmStaff";

type StoredStaffAppSession = {
  token: string;
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

async function ensureStaffAppSessionStore() {
  try {
    await fs.access(sessionStorePath);
  } catch {
    await fs.mkdir(sessionStoreDirectory, { recursive: true });
    await fs.writeFile(sessionStorePath, "[]", "utf8");
  }
}

async function readStaffAppSessionStore() {
  await ensureStaffAppSessionStore();
  const raw = await fs.readFile(sessionStorePath, "utf8");
  return (JSON.parse(raw) as StoredStaffAppSession[]).map(normalizeStoredStaffAppSession);
}

async function writeStaffAppSessionStore(sessions: StoredStaffAppSession[]) {
  await fs.writeFile(sessionStorePath, JSON.stringify(sessions, null, 2), "utf8");
}

export async function createStaffAppSession(target: string | StaffAppSessionTarget) {
  const sessions = await readStaffAppSessionStore();
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(sessionCookieName)?.value;
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
          token: randomUUID(),
          subjectType: "scmStaff",
          scmStaffProfileId: sessionTarget.scmStaffProfileId,
          createdAt: new Date().toISOString(),
        }
      : {
          token: randomUUID(),
          subjectType: "staff",
          accountId: sessionTarget.accountId,
          createdAt: new Date().toISOString(),
        };

  const nextSessions = existingToken
    ? sessions.filter((storedSession) => storedSession.token !== existingToken)
    : sessions;

  nextSessions.push(session);
  await writeStaffAppSessionStore(nextSessions);

  cookieStore.set(sessionCookieName, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function destroyCurrentStaffAppSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (sessionToken) {
    const sessions = await readStaffAppSessionStore();
    await writeStaffAppSessionStore(
      sessions.filter((session) => session.token !== sessionToken),
    );
  }

  cookieStore.delete(sessionCookieName);
}

export async function getCurrentStaffAppSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    return null;
  }

  const sessions = await readStaffAppSessionStore();
  return sessions.find((session) => session.token === sessionToken) ?? null;
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

  return userContext.appRole === "SCM STAFF" ? "/staff-app/scm" : "/staff-app/home";
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
