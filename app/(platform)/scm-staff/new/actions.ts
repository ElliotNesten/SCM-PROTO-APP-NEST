"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createStoredScmStaffProfile } from "@/lib/scm-staff-store";
import { createPasswordHash, getSeedScmStaffPassword } from "@/lib/password-utils";
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

export async function submitNewScmStaff(formData: FormData) {
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
    displayName: readString(formData, "displayName"),
    email: readString(formData, "email"),
    passwordHash: createPasswordHash(
      getSeedScmStaffPassword(readString(formData, "email")),
    ),
    passwordPlaintext: getSeedScmStaffPassword(readString(formData, "email")),
    phone: readString(formData, "phone"),
    roleKey,
    country,
    regions,
    assignedGigIds: [],
    linkedStaffId: undefined,
    linkedStaffName: undefined,
    notes: readString(formData, "notes"),
  });

  revalidatePath("/scm-staff");
  revalidatePath(`/scm-staff/${createdProfile.id}`);

  redirect(`/scm-staff/${createdProfile.id}`);
}
