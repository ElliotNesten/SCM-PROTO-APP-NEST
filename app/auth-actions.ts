"use server";

import { redirect } from "next/navigation";

import { createAuthSession, destroyCurrentAuthSession } from "@/lib/auth-session";
import {
  getPlatformAccessibleGigIdsForTemporaryManagerStaffProfile,
} from "@/lib/gig-store";
import { verifyPasswordHash } from "@/lib/password-utils";
import {
  ensureStaffAppAccountForLinkedStaffProfile,
  getStaffAppAccountByEmail,
  verifyStaffAppAccountPassword,
} from "@/lib/staff-app-store";
import {
  getStoredStaffProfileByEmail,
} from "@/lib/staff-store";
import {
  getStoredScmStaffProfileByEmail,
  getStoredScmStaffProfileById,
  updateStoredScmStaffProfile,
} from "@/lib/scm-staff-store";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function loginWithScmStaff(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const normalizedPassword = password.trim();

  if (!email || !password) {
    redirect(`/login?error=missing&email=${encodeURIComponent(email)}`);
  }

  const profile = await getStoredScmStaffProfileByEmail(email);
  let accessExpired = false;

  if (
    profile &&
    profile.roleKey !== "temporaryGigManager" &&
    verifyPasswordHash(normalizedPassword, profile.passwordHash)
  ) {
    if (profile.passwordPlaintext?.trim() !== normalizedPassword) {
      await updateStoredScmStaffProfile(profile.id, {
        passwordPlaintext: normalizedPassword,
      });
    }

    await createAuthSession(profile.id);
    redirect("/dashboard");
  }

  const existingStaffAppAccount = await getStaffAppAccountByEmail(email);
  const staffAppAccount =
    existingStaffAppAccount ??
    (await (async () => {
      const linkedStaffProfile = await getStoredStaffProfileByEmail(email);

      if (!linkedStaffProfile) {
        return null;
      }

      return ensureStaffAppAccountForLinkedStaffProfile({
        id: linkedStaffProfile.id,
        displayName: linkedStaffProfile.displayName,
        email: linkedStaffProfile.email,
        phone: linkedStaffProfile.phone,
        country: linkedStaffProfile.country,
        region: linkedStaffProfile.region,
        roleProfiles: linkedStaffProfile.roleProfiles,
        roles: linkedStaffProfile.roles,
        priority: linkedStaffProfile.priority,
        profileImageUrl: linkedStaffProfile.profileImageUrl,
      });
    })());

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

  redirect(
    `/login?error=${accessExpired ? "expired" : "invalid"}&email=${encodeURIComponent(email)}`,
  );
}

export async function logoutCurrentUser() {
  await destroyCurrentAuthSession();
  redirect("/login");
}

export async function switchScmStaffSession(formData: FormData) {
  const profileId = readString(formData, "profileId");

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
