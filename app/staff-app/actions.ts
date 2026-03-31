"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  checkInToStaffAppShift,
  checkOutFromStaffAppShift,
  getStaffAppAttendanceState,
} from "@/lib/staff-app-attendance-store";
import {
  getStaffAppGigPassById,
  getStaffAppMessageThreadById,
} from "@/lib/staff-app-data";
import { applyToStaffAppGig } from "@/lib/staff-app-gig-application-store";
import { appendReplyToShiftCommunicationThread } from "@/lib/shift-communication-replies";
import {
  createStaffAppSession,
  destroyCurrentStaffAppSession,
  getCurrentStaffAppAccount,
} from "@/lib/staff-app-session";
import { verifyPasswordHash } from "@/lib/password-utils";
import { getStoredScmStaffProfileByEmail } from "@/lib/scm-staff-store";
import {
  ensureStaffAppAccountForLinkedStaffProfile,
  getStaffAppAccountByEmail,
  updateStaffAppAccountPassword,
  verifyStaffAppAccountPassword,
} from "@/lib/staff-app-store";
import { updateStoredStaffProfile } from "@/lib/staff-store";
import { getStoredStaffProfileByEmail } from "@/lib/staff-store";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function loginToStaffApp(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");

  if (!email || !password) {
    redirect(`/staff-app/login?error=missing&email=${encodeURIComponent(email)}`);
  }

  const scmStaffProfile = await getStoredScmStaffProfileByEmail(email);

  if (
    scmStaffProfile &&
    scmStaffProfile.roleKey !== "temporaryGigManager" &&
    verifyPasswordHash(password, scmStaffProfile.passwordHash)
  ) {
    await createStaffAppSession({
      subjectType: "scmStaff",
      scmStaffProfileId: scmStaffProfile.id,
    });
    redirect("/staff-app/scm");
  }

  const linkedProfile = await getStoredStaffProfileByEmail(email);
  const account = linkedProfile
    ? await ensureStaffAppAccountForLinkedStaffProfile({
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
      })
    : await getStaffAppAccountByEmail(email);

  if (!account || !verifyStaffAppAccountPassword(account, password)) {
    redirect(`/staff-app/login?error=invalid&email=${encodeURIComponent(email)}`);
  }

  await createStaffAppSession({
    subjectType: "staff",
    accountId: account.id,
  });
  redirect("/staff-app/home");
}

export async function logoutOfStaffApp() {
  await destroyCurrentStaffAppSession();
  redirect("/staff-app/login");
}

export async function changeStaffAppPassword(formData: FormData) {
  const currentPassword = readString(formData, "currentPassword");
  const nextPassword = readString(formData, "nextPassword");
  const confirmPassword = readString(formData, "confirmPassword");
  const account = await getCurrentStaffAppAccount();

  if (!account) {
    redirect("/staff-app/login");
  }

  if (!currentPassword || !nextPassword || !confirmPassword) {
    redirect("/staff-app/profile?password=missing");
  }

  if (!verifyStaffAppAccountPassword(account, currentPassword)) {
    redirect("/staff-app/profile?password=invalid");
  }

  if (nextPassword.length < 6) {
    redirect("/staff-app/profile?password=length");
  }

  if (nextPassword !== confirmPassword) {
    redirect("/staff-app/profile?password=mismatch");
  }

  await updateStaffAppAccountPassword(account.id, nextPassword);
  redirect("/staff-app/profile?password=success");
}

export async function updateStaffAppBankInfo(formData: FormData) {
  const account = await getCurrentStaffAppAccount();
  const bankName = readString(formData, "bankName");
  const bankDetails = readString(formData, "bankDetails");

  if (!account) {
    redirect("/staff-app/login");
  }

  if (!account.linkedStaffProfileId) {
    redirect("/staff-app/profile/bank-info?status=unavailable");
  }

  const updatedProfile = await updateStoredStaffProfile(account.linkedStaffProfileId, {
    bankName,
    bankDetails,
  });

  if (!updatedProfile) {
    redirect("/staff-app/profile/bank-info?status=unavailable");
  }

  revalidatePath("/staff-app/profile");
  revalidatePath("/staff-app/profile/bank-info");
  revalidatePath(`/people/${account.linkedStaffProfileId}`);
  revalidatePath("/people");
  redirect("/staff-app/profile/bank-info?status=success");
}

export async function updateStaffAppPersonalDetails(formData: FormData) {
  const account = await getCurrentStaffAppAccount();
  const personalNumber = readString(formData, "personalNumber");
  const allergies = readString(formData, "allergies");
  const driverLicenseManual = readCheckbox(formData, "driverLicenseManual");
  const driverLicenseAutomatic = readCheckbox(formData, "driverLicenseAutomatic");

  if (!account) {
    redirect("/staff-app/login");
  }

  if (!account.linkedStaffProfileId) {
    redirect("/staff-app/profile/personal-details?status=unavailable");
  }

  const updatedProfile = await updateStoredStaffProfile(account.linkedStaffProfileId, {
    personalNumber,
    allergies,
    driverLicenseManual,
    driverLicenseAutomatic,
  });

  if (!updatedProfile) {
    redirect("/staff-app/profile/personal-details?status=unavailable");
  }

  revalidatePath("/staff-app/profile");
  revalidatePath("/staff-app/profile/personal-details");
  revalidatePath(`/people/${account.linkedStaffProfileId}`);
  revalidatePath("/people");
  redirect("/staff-app/profile/personal-details?status=success");
}

export async function checkInToStaffAppTodayShift(formData: FormData) {
  const account = await getCurrentStaffAppAccount();
  const shiftId = readString(formData, "shiftId");

  if (!account) {
    redirect("/staff-app/login");
  }

  if (!shiftId) {
    redirect("/staff-app/check-in?status=missing");
  }

  const attendanceState = await getStaffAppAttendanceState(account);

  if (!attendanceState.todayShift || attendanceState.todayShift.id !== shiftId) {
    redirect("/staff-app/check-in?status=unavailable");
  }

  if (!attendanceState.canCheckIn) {
    redirect("/staff-app/check-in?status=already-in");
  }

  await checkInToStaffAppShift(account.id, shiftId);
  revalidatePath("/staff-app/home");
  revalidatePath("/staff-app/check-in");
  revalidatePath(`/staff-app/shifts/${shiftId}`);
  redirect("/staff-app/check-in?status=checked-in");
}

export async function checkOutFromStaffAppTodayShift(formData: FormData) {
  const account = await getCurrentStaffAppAccount();
  const shiftId = readString(formData, "shiftId");

  if (!account) {
    redirect("/staff-app/login");
  }

  if (!shiftId) {
    redirect("/staff-app/check-in?status=missing");
  }

  const attendanceState = await getStaffAppAttendanceState(account);

  if (!attendanceState.todayShift || attendanceState.todayShift.id !== shiftId) {
    redirect("/staff-app/check-in?status=unavailable");
  }

  if (!attendanceState.canCheckOut) {
    redirect("/staff-app/check-in?status=not-ready");
  }

  await checkOutFromStaffAppShift(account.id, shiftId);
  revalidatePath("/staff-app/home");
  revalidatePath("/staff-app/check-in");
  revalidatePath(`/staff-app/shifts/${shiftId}`);
  redirect("/staff-app/check-in?status=checked-out");
}

export async function applyToStaffAppGigPass(formData: FormData) {
  const account = await getCurrentStaffAppAccount();
  const passId = readString(formData, "passId");

  if (!account) {
    redirect("/staff-app/login");
  }

  if (!passId) {
    redirect("/staff-app/gigs?status=missing");
  }

  const pass = await getStaffAppGigPassById(account, passId);

  if (!pass || pass.feed !== "open") {
    redirect("/staff-app/gigs?status=unavailable");
  }

  await applyToStaffAppGig(account.id, passId);
  revalidatePath("/staff-app/gigs");
  revalidatePath("/staff-app/gigs/open");
  revalidatePath(`/staff-app/gigs/${passId}`);
  redirect(`/staff-app/gigs/${passId}?applied=success`);
}

export async function sendStaffAppMessageReply(formData: FormData) {
  const account = await getCurrentStaffAppAccount();
  const gigId = readString(formData, "gigId");
  const threadId = readString(formData, "threadId");
  const returnTo = readString(formData, "returnTo") || `/staff-app/messages/${threadId}`;
  const body = readString(formData, "body");
  const attachments = formData
    .getAll("attachment")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!account) {
    redirect("/staff-app/login");
  }

  if (!gigId || !threadId || !account.linkedStaffProfileId) {
    redirect(returnTo);
  }

  const thread = await getStaffAppMessageThreadById(threadId, account);

  if (
    !thread ||
    thread.gigId !== gigId ||
    thread.messages.length === 0 ||
    thread.messages.at(-1)?.allowReplies === false
  ) {
    redirect(returnTo);
  }

  try {
    await appendReplyToShiftCommunicationThread({
      gigId,
      threadId,
      body,
      attachments,
      authorName: account.displayName,
      authorProfileId: account.linkedStaffProfileId,
      authorType: "staff",
    });
  } catch {
    redirect(returnTo);
  }

  revalidatePath("/staff-app/messages");
  revalidatePath(returnTo);
  redirect(returnTo);
}
