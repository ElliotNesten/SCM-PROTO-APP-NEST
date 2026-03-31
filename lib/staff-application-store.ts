import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  StaffApplicationApprovalEmailStatus,
  StoredStaffApplication,
  StaffApplicationStatus,
} from "@/types/job-applications";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-application-store.json");

async function ensureStaffApplicationStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify([], null, 2), "utf8");
  }
}

async function readStaffApplicationStore() {
  await ensureStaffApplicationStore();
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw) as StoredStaffApplication[];
}

async function writeStaffApplicationStore(applications: StoredStaffApplication[]) {
  await fs.writeFile(storePath, JSON.stringify(applications, null, 2), "utf8");
}

export async function getAllStoredStaffApplications() {
  const applications = await readStaffApplicationStore();

  return [...applications].sort(
    (left, right) =>
      new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
  );
}

export async function getStoredStaffApplicationById(applicationId: string) {
  const applications = await readStaffApplicationStore();
  return applications.find((application) => application.id === applicationId) ?? null;
}

export async function getStoredStaffApplicationByEmail(email: string) {
  const applications = await readStaffApplicationStore();
  return (
    applications.find(
      (application) => application.email.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

export async function getActiveStoredStaffApplicationByEmail(email: string) {
  const applications = await readStaffApplicationStore();
  return (
    applications.find(
      (application) =>
        application.email.toLowerCase() === email.toLowerCase() &&
        application.status !== "rejected",
    ) ?? null
  );
}

type CreateStaffApplicationInput = {
  id?: string;
  profileImageName: string;
  profileImageUrl: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
};

export async function createStoredStaffApplication(
  input: CreateStaffApplicationInput,
) {
  const applications = await readStaffApplicationStore();
  const createdApplication: StoredStaffApplication = {
    id: input.id ?? `application-${randomUUID().slice(0, 8)}`,
    status: "pending",
    profileImageName: input.profileImageName,
    profileImageUrl: input.profileImageUrl,
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    country: input.country.trim(),
    region: input.region.trim(),
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedByProfileId: null,
    reviewedByName: null,
    rejectionReason: null,
    convertedStaffProfileId: null,
    approvalEmailStatus: "not_requested",
    approvalEmailLastAttemptAt: null,
    approvalEmailError: null,
    passwordSetupTokenId: null,
  };

  applications.unshift(createdApplication);
  await writeStaffApplicationStore(applications);
  return createdApplication;
}

type StaffApplicationUpdate = Partial<
  Pick<
    StoredStaffApplication,
    | "status"
    | "reviewedAt"
    | "reviewedByProfileId"
    | "reviewedByName"
    | "rejectionReason"
    | "convertedStaffProfileId"
    | "approvalEmailStatus"
    | "approvalEmailLastAttemptAt"
    | "approvalEmailError"
    | "passwordSetupTokenId"
  >
>;

export async function updateStoredStaffApplication(
  applicationId: string,
  updates: StaffApplicationUpdate,
) {
  const applications = await readStaffApplicationStore();
  const applicationIndex = applications.findIndex(
    (application) => application.id === applicationId,
  );

  if (applicationIndex === -1) {
    return null;
  }

  const updatedApplication: StoredStaffApplication = {
    ...applications[applicationIndex],
    ...updates,
  };

  applications[applicationIndex] = updatedApplication;
  await writeStaffApplicationStore(applications);
  return updatedApplication;
}

export async function reviewStoredStaffApplication(
  applicationId: string,
  input: {
    status: StaffApplicationStatus;
    reviewedByProfileId: string;
    reviewedByName: string;
    rejectionReason?: string | null;
    convertedStaffProfileId?: string | null;
    approvalEmailStatus?: StaffApplicationApprovalEmailStatus;
    approvalEmailLastAttemptAt?: string | null;
    approvalEmailError?: string | null;
    passwordSetupTokenId?: string | null;
  },
) {
  return updateStoredStaffApplication(applicationId, {
    status: input.status,
    reviewedAt: new Date().toISOString(),
    reviewedByProfileId: input.reviewedByProfileId,
    reviewedByName: input.reviewedByName,
    rejectionReason: input.rejectionReason ?? null,
    convertedStaffProfileId: input.convertedStaffProfileId ?? null,
    approvalEmailStatus:
      input.approvalEmailStatus ?? (input.status === "approved" ? "pending" : "not_requested"),
    approvalEmailLastAttemptAt: input.approvalEmailLastAttemptAt ?? null,
    approvalEmailError: input.approvalEmailError ?? null,
    passwordSetupTokenId: input.passwordSetupTokenId ?? null,
  });
}
