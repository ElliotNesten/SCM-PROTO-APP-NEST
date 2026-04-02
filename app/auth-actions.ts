"use server";

import { redirect } from "next/navigation";

import { createAuthSession, destroyCurrentAuthSession } from "@/lib/auth-session";
import {
  getPlatformAccessibleGigIdsForTemporaryManagerStaffProfile,
} from "@/lib/gig-store";
import { verifyPasswordHash } from "@/lib/password-utils";
import {
  getStaffAppAccountByEmail,
  verifyStaffAppAccountPassword,
} from "@/lib/staff-app-store";
import {
  getStoredScmStaffProfileByEmail,
  getStoredScmStaffProfileById,
} from "@/lib/scm-staff-store";
import { isSessionCookieConfigurationAvailable } from "@/lib/session-cookie";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildLoginRedirectUrl(
  error: "missing" | "invalid" | "expired" | "config",
  email: string,
  mode: string,
) {
  const searchParams = new URLSearchParams({
    error,
    email,
  });

  if (mode === "switch") {
    searchParams.set("mode", mode);
  }

  return `/login?${searchParams.toString()}`;
}

export async function loginWithScmStaff(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const mode = readString(formData, "mode");
  const normalizedPassword = password.trim();

  if (!isSessionCookieConfigurationAvailable()) {
    redirect(buildLoginRedirectUrl("config", email, mode));
  }

  if (!email || !password) {
    redirect(buildLoginRedirectUrl("missing", email, mode));
  }

  const profile = await getStoredScmStaffProfileByEmail(email);
  let accessExpired = false;

  if (
    profile &&
    profile.roleKey !== "temporaryGigManager" &&
    verifyPasswordHash(normalizedPassword, profile.passwordHash)
  ) {
    await createAuthSession(profile.id);
    redirect("/dashboard");
  }

  const staffAppAccount = await getStaffAppAccountByEmail(email);

  if (staffAppAccount && verifyStaffAppAccountPassword(staffAppAccount, password)) {
    const linkedStaffProfileId = staffAppAccount.linkedStaffProfileId?.trim() ?? "";
    const activeGigIds = linkedStaffProfileId
      ? await getPlatformAccessibleGigIdsForTemporaryManagerStaffProfile(linkedStaffProfileId)
      : [];

    if (linkedStaffProfileId && activeGigIds.length > 0) {
      await createAuthSession({
        subjectType: "temporaryGigManager",
        linkedStaffProfileId,
      });
      redirect("/dashboard");
    }

    accessExpired = accessExpired || Boolean(linkedStaffProfileId);
  }

  redirect(buildLoginRedirectUrl(accessExpired ? "expired" : "invalid", email, mode));
}

export async function logoutCurrentUser() {
  await destroyCurrentAuthSession();
  redirect("/login");
}

export async function switchScmStaffSession(formData: FormData) {
  const profileId = readString(formData, "profileId");

  if (!isSessionCookieConfigurationAvailable()) {
    redirect("/login?error=config");
  }

  if (!profileId) {
    redirect("/profile");
  }

  const profile = await getStoredScmStaffProfileById(profileId);

  if (!profile) {
    redirect("/profile");
  }

  await createAuthSession(profile.id);
  redirect("/profile");
}
