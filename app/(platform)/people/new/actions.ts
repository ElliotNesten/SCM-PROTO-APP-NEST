"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureStaffAppAccountForLinkedStaffProfile } from "@/lib/staff-app-store";
import { createStoredStaffProfile } from "@/lib/staff-store";
import type { RegistrationStatus } from "@/types/backend";
import type { StaffApprovalStatus } from "@/types/scm";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, key: string) {
  const value = Number(readString(formData, key));
  return Number.isFinite(value) ? value : 0;
}

export async function submitNewStaff(formData: FormData) {
  const approvalStatus = readString(formData, "approvalStatus") as StaffApprovalStatus;
  const registrationStatus = readString(formData, "registrationStatus") as RegistrationStatus;
  const roleScope = readString(formData, "roles");

  const createdProfile = await createStoredStaffProfile({
    displayName: readString(formData, "displayName"),
    email: readString(formData, "email"),
    phone: readString(formData, "phone"),
    country: readString(formData, "country"),
    region: readString(formData, "region"),
    regions: [readString(formData, "region")].filter(Boolean),
    roles: roleScope
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean),
    priority: Math.min(5, Math.max(1, readNumber(formData, "priority"))),
    availability: readString(formData, "availability") || "Available",
    approvalStatus,
    accessRoleLabel: readString(formData, "accessRoleLabel") || "Field staff",
    registrationStatus,
    profileApproved: readString(formData, "profileApproved") === "approved",
    bankName: "",
    bankDetails: readString(formData, "bankDetails"),
    personalNumber: readString(formData, "personalNumber"),
    driverLicenseManual: false,
    driverLicenseAutomatic: false,
    allergies: "",
    profileComments: readString(formData, "profileComments"),
    pendingRecords: readString(formData, "pendingRecords")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  });

  await ensureStaffAppAccountForLinkedStaffProfile({
    id: createdProfile.id,
    displayName: createdProfile.displayName,
    email: createdProfile.email,
    phone: createdProfile.phone,
    country: createdProfile.country,
    region: createdProfile.region,
    roleProfiles: createdProfile.roleProfiles,
    roles: createdProfile.roles,
    priority: createdProfile.priority,
    profileImageUrl: createdProfile.profileImageUrl,
  });

  revalidatePath("/people");
  revalidatePath(`/people/${createdProfile.id}`);

  redirect(`/people/${createdProfile.id}`);
}
