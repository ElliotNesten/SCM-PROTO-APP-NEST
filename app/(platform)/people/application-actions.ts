"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import {
  createStoredStaffProfile,
  getStoredStaffProfileByEmail,
  getStoredStaffProfileById,
} from "@/lib/staff-store";
import {
  getStoredStaffApplicationById,
  reviewStoredStaffApplication,
  updateStoredStaffApplication,
} from "@/lib/staff-application-store";
import {
  createPendingStaffAppAccountForLinkedStaffProfile,
  getStaffAppAccountByLinkedStaffProfileId,
} from "@/lib/staff-app-store";
import { createPasswordSetupToken } from "@/lib/password-setup-token-store";
import { sendApprovedStaffApplicationEmail } from "@/lib/staff-application-email";
import { canAccessPlatformStaffDirectory } from "@/lib/platform-access";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getAppBaseUrl() {
  return (process.env.SCM_APP_BASE_URL?.trim() || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function getDefaultPendingRecords() {
  return [
    "Personal number",
    "Bank information",
    "Profile onboarding",
    "Policy confirmations",
    "Own bookings",
    "Own contracts",
    "Own payslips",
    "Own completed gigs",
  ];
}

async function requireApplicationReviewer() {
  const currentProfile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!canAccessPlatformStaffDirectory(currentProfile.roleKey)) {
    redirect("/dashboard");
  }

  return currentProfile;
}

export async function approveStaffApplication(formData: FormData) {
  const currentProfile = await requireApplicationReviewer();
  const applicationId = readString(formData, "applicationId");

  if (!applicationId) {
    redirect("/people?review=missing");
  }

  const application = await getStoredStaffApplicationById(applicationId);

  if (!application) {
    redirect("/people?review=not-found");
  }

  if (application.status !== "pending") {
    redirect("/people?review=already-reviewed");
  }

  const existingStaffProfile = await getStoredStaffProfileByEmail(application.email);

  if (existingStaffProfile) {
    redirect("/people?review=duplicate-email");
  }

  const createdProfile = await createStoredStaffProfile({
    displayName: application.displayName,
    email: application.email,
    phone: application.phone,
    country: application.country,
    region: application.region,
    regions: [application.region].filter(Boolean),
    roles: [],
    priority: 3,
    availability: "Available",
    approvalStatus: "Approved",
    accessRoleLabel: "Field staff",
    registrationStatus: "APPROVED",
    profileApproved: true,
    profileImageName: application.profileImageName,
    profileImageUrl: application.profileImageUrl,
    bankName: "",
    bankDetails: "",
    personalNumber: "",
    driverLicenseManual: false,
    driverLicenseAutomatic: false,
    allergies: "",
    profileComments: "Created from Work at SCM application.",
    pendingRecords: getDefaultPendingRecords(),
  });

  const pendingAccount = await createPendingStaffAppAccountForLinkedStaffProfile({
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
    createdFromApplicationId: application.id,
  });
  const token = await createPasswordSetupToken({
    email: createdProfile.email,
    staffProfileId: createdProfile.id,
    staffAppAccountId: pendingAccount.id,
    applicationId: application.id,
  });
  const createPasswordUrl = `${getAppBaseUrl()}/staff-app/create-password?token=${encodeURIComponent(token.token)}`;
  const emailDelivery = await sendApprovedStaffApplicationEmail({
    application,
    createPasswordUrl,
    expiresAt: token.record.expiresAt,
  });

  await reviewStoredStaffApplication(application.id, {
    status: "approved",
    reviewedByProfileId: currentProfile.id,
    reviewedByName: currentProfile.displayName,
    convertedStaffProfileId: createdProfile.id,
    approvalEmailStatus: emailDelivery.ok ? "sent" : "failed",
    approvalEmailLastAttemptAt: new Date().toISOString(),
    approvalEmailError: emailDelivery.ok ? null : emailDelivery.error,
    passwordSetupTokenId: token.record.id,
  });

  revalidatePath("/people");
  revalidatePath(`/people/${createdProfile.id}`);
  redirect(`/people?review=${emailDelivery.ok ? "approved" : "approved-email-failed"}`);
}

export async function rejectStaffApplication(formData: FormData) {
  const currentProfile = await requireApplicationReviewer();
  const applicationId = readString(formData, "applicationId");

  if (!applicationId) {
    redirect("/people?review=missing");
  }

  const application = await getStoredStaffApplicationById(applicationId);

  if (!application) {
    redirect("/people?review=not-found");
  }

  if (application.status !== "pending") {
    redirect("/people?review=already-reviewed");
  }

  await reviewStoredStaffApplication(application.id, {
    status: "rejected",
    reviewedByProfileId: currentProfile.id,
    reviewedByName: currentProfile.displayName,
    rejectionReason: "Rejected from the People application review panel.",
  });

  revalidatePath("/people");
  redirect("/people?review=rejected");
}

export async function resendStaffApplicationActivationEmail(formData: FormData) {
  await requireApplicationReviewer();
  const applicationId = readString(formData, "applicationId");

  if (!applicationId) {
    redirect("/people?review=missing");
  }

  const application = await getStoredStaffApplicationById(applicationId);

  if (!application || application.status !== "approved" || !application.convertedStaffProfileId) {
    redirect("/people?review=not-found");
  }

  const [staffProfile, existingAccount] = await Promise.all([
    getStoredStaffProfileById(application.convertedStaffProfileId),
    getStaffAppAccountByLinkedStaffProfileId(application.convertedStaffProfileId),
  ]);

  if (!staffProfile) {
    redirect("/people?review=not-found");
  }

  if (staffProfile.registrationStatus === "ACTIVATED") {
    redirect("/people?review=already-activated");
  }

  const pendingAccount =
    existingAccount ??
    (await createPendingStaffAppAccountForLinkedStaffProfile({
      id: staffProfile.id,
      displayName: staffProfile.displayName,
      email: staffProfile.email,
      phone: staffProfile.phone,
      country: staffProfile.country,
      region: staffProfile.region,
      roleProfiles: staffProfile.roleProfiles,
      roles: staffProfile.roles,
      priority: staffProfile.priority,
      profileImageUrl: staffProfile.profileImageUrl,
      createdFromApplicationId: application.id,
    }));
  const token = await createPasswordSetupToken({
    email: staffProfile.email,
    staffProfileId: staffProfile.id,
    staffAppAccountId: pendingAccount.id,
    applicationId: application.id,
  });
  const createPasswordUrl = `${getAppBaseUrl()}/staff-app/create-password?token=${encodeURIComponent(token.token)}`;
  const emailDelivery = await sendApprovedStaffApplicationEmail({
    application,
    createPasswordUrl,
    expiresAt: token.record.expiresAt,
  });

  await updateStoredStaffApplication(application.id, {
    approvalEmailStatus: emailDelivery.ok ? "sent" : "failed",
    approvalEmailLastAttemptAt: new Date().toISOString(),
    approvalEmailError: emailDelivery.ok ? null : emailDelivery.error,
    passwordSetupTokenId: token.record.id,
  });

  revalidatePath("/people");
  redirect(`/people?review=${emailDelivery.ok ? "email-resent" : "approved-email-failed"}`);
}
