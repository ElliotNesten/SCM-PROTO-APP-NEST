"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createStoredScmStaffProfile,
  getStoredScmStaffProfileByEmail,
} from "@/lib/scm-staff-store";
import { createPasswordHash } from "@/lib/password-utils";
import {
  createPasswordSetupToken,
  getScmStaffPasswordSetupAccountId,
} from "@/lib/password-setup-token-store";
import { sendScmStaffActivationEmail } from "@/lib/scm-staff-activation-email";
import {
  isManuallyManagedScmStaffRole,
  type ScmStaffManagedRoleKey,
} from "@/types/scm-rbac";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readRegions(formData: FormData) {
  return readString(formData, "regions")
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAppBaseUrl() {
  return (process.env.SCM_APP_BASE_URL?.trim() || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function submitNewScmStaff(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();

  if (!email) {
    redirect("/scm-staff/new?create=missing-email");
  }

  const existingProfile = await getStoredScmStaffProfileByEmail(email);

  if (existingProfile) {
    redirect("/scm-staff/new?create=duplicate-email");
  }

  const requestedRoleKey = readString(formData, "roleKey");
  const roleKey: ScmStaffManagedRoleKey = isManuallyManagedScmStaffRole(requestedRoleKey)
    ? requestedRoleKey
    : "officeStaff";
  const country =
    roleKey === "regionalManager"
      ? readString(formData, "country") || "Sweden"
      : "Global";
  const regions = roleKey === "regionalManager" ? readRegions(formData) : [];

  const createdProfile = await createStoredScmStaffProfile({
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    email,
    passwordHash: createPasswordHash(randomUUID()),
    passwordPlaintext: "",
    phone: readString(formData, "phone"),
    roleKey,
    country,
    regions,
    assignedGigIds: [],
    linkedStaffId: undefined,
    linkedStaffName: undefined,
    notes: readString(formData, "notes"),
  });
  const token = await createPasswordSetupToken({
    email: createdProfile.email,
    subjectType: "scmStaff",
    staffProfileId: createdProfile.id,
    staffAppAccountId: getScmStaffPasswordSetupAccountId(createdProfile.id),
    scmStaffProfileId: createdProfile.id,
  });
  const createPasswordUrl = `${getAppBaseUrl()}/staff-app/create-password?token=${encodeURIComponent(token.token)}`;
  const emailDelivery = await sendScmStaffActivationEmail({
    profile: createdProfile,
    createPasswordUrl,
    expiresAt: token.record.expiresAt,
  });

  revalidatePath("/scm-staff");
  revalidatePath(`/scm-staff/${createdProfile.id}`);

  redirect(
    `/scm-staff/${createdProfile.id}?invite=${emailDelivery.ok ? "sent" : "failed"}`,
  );
}
