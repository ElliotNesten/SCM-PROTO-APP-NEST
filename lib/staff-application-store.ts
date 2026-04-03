import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureProductionStorageSchema,
  getPostgresClient,
} from "@/lib/postgres";
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

type StaffApplicationRow = {
  id: string;
  status: StaffApplicationStatus;
  profile_image_name: string;
  profile_image_url: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by_profile_id: string | null;
  reviewed_by_name: string | null;
  rejection_reason: string | null;
  converted_staff_profile_id: string | null;
  approval_email_status: StaffApplicationApprovalEmailStatus;
  approval_email_last_attempt_at: string | null;
  approval_email_error: string | null;
  password_setup_token_id: string | null;
};

function mapStaffApplicationRow(row: StaffApplicationRow): StoredStaffApplication {
  return {
    id: row.id,
    status: row.status,
    profileImageName: row.profile_image_name,
    profileImageUrl: row.profile_image_url,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    region: row.region,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedByProfileId: row.reviewed_by_profile_id,
    reviewedByName: row.reviewed_by_name,
    rejectionReason: row.rejection_reason,
    convertedStaffProfileId: row.converted_staff_profile_id,
    approvalEmailStatus: row.approval_email_status,
    approvalEmailLastAttemptAt: row.approval_email_last_attempt_at,
    approvalEmailError: row.approval_email_error,
    passwordSetupTokenId: row.password_setup_token_id,
  };
}

export async function getAllStoredStaffApplications() {
  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<StaffApplicationRow[]>`
      select *
      from staff_applications
      order by submitted_at desc
    `;

    return rows.map(mapStaffApplicationRow);
  }

  const applications = await readStaffApplicationStore();

  return [...applications].sort(
    (left, right) =>
      new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
  );
}

export async function getStoredStaffApplicationById(applicationId: string) {
  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<StaffApplicationRow[]>`
      select *
      from staff_applications
      where id = ${applicationId}
      limit 1
    `;

    return rows[0] ? mapStaffApplicationRow(rows[0]) : null;
  }

  const applications = await readStaffApplicationStore();
  return applications.find((application) => application.id === applicationId) ?? null;
}

export async function getStoredStaffApplicationByEmail(email: string) {
  const sql = getPostgresClient();
  const normalizedEmail = email.toLowerCase().trim();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<StaffApplicationRow[]>`
      select *
      from staff_applications
      where email_lower = ${normalizedEmail}
      order by submitted_at desc
      limit 1
    `;

    return rows[0] ? mapStaffApplicationRow(rows[0]) : null;
  }

  const applications = await readStaffApplicationStore();
  return (
    applications.find(
      (application) => application.email.toLowerCase() === normalizedEmail,
    ) ?? null
  );
}

export async function getActiveStoredStaffApplicationByEmail(email: string) {
  const sql = getPostgresClient();
  const normalizedEmail = email.toLowerCase().trim();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<StaffApplicationRow[]>`
      select *
      from staff_applications
      where email_lower = ${normalizedEmail}
        and status <> 'rejected'
      order by submitted_at desc
      limit 1
    `;

    return rows[0] ? mapStaffApplicationRow(rows[0]) : null;
  }

  const applications = await readStaffApplicationStore();
  return (
    applications.find(
      (application) =>
        application.email.toLowerCase() === normalizedEmail &&
        application.status !== "rejected",
    ) ?? null
  );
}

type CreateStaffApplicationInput = {
  id?: string;
  profileImageName: string;
  profileImageUrl: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
};

export async function createStoredStaffApplication(
  input: CreateStaffApplicationInput,
) {
  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    const createdApplication: StoredStaffApplication = {
      id: input.id ?? `application-${randomUUID().slice(0, 8)}`,
      status: "pending",
      profileImageName: input.profileImageName,
      profileImageUrl: input.profileImageUrl,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
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

    await sql`
      insert into staff_applications (
        id, status, profile_image_name, profile_image_url, first_name, last_name, email, email_lower,
        phone, country, region, submitted_at, reviewed_at, reviewed_by_profile_id,
        reviewed_by_name, rejection_reason, converted_staff_profile_id, approval_email_status,
        approval_email_last_attempt_at, approval_email_error, password_setup_token_id
      ) values (
        ${createdApplication.id},
        ${createdApplication.status},
        ${createdApplication.profileImageName},
        ${createdApplication.profileImageUrl},
        ${createdApplication.firstName},
        ${createdApplication.lastName},
        ${createdApplication.email},
        ${createdApplication.email.toLowerCase()},
        ${createdApplication.phone},
        ${createdApplication.country},
        ${createdApplication.region},
        ${createdApplication.submittedAt},
        ${createdApplication.reviewedAt},
        ${createdApplication.reviewedByProfileId},
        ${createdApplication.reviewedByName},
        ${createdApplication.rejectionReason},
        ${createdApplication.convertedStaffProfileId},
        ${createdApplication.approvalEmailStatus},
        ${createdApplication.approvalEmailLastAttemptAt},
        ${createdApplication.approvalEmailError},
        ${createdApplication.passwordSetupTokenId}
      )
    `;

    return createdApplication;
  }

  const applications = await readStaffApplicationStore();
  const createdApplication: StoredStaffApplication = {
    id: input.id ?? `application-${randomUUID().slice(0, 8)}`,
    status: "pending",
    profileImageName: input.profileImageName,
    profileImageUrl: input.profileImageUrl,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
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
  const sql = getPostgresClient();

  if (sql) {
    const currentApplication = await getStoredStaffApplicationById(applicationId);

    if (!currentApplication) {
      return null;
    }

    const updatedApplication: StoredStaffApplication = {
      ...currentApplication,
      ...updates,
    };

    await ensureProductionStorageSchema();
    await sql`
      update staff_applications
      set
        status = ${updatedApplication.status},
        reviewed_at = ${updatedApplication.reviewedAt},
        reviewed_by_profile_id = ${updatedApplication.reviewedByProfileId},
        reviewed_by_name = ${updatedApplication.reviewedByName},
        rejection_reason = ${updatedApplication.rejectionReason},
        converted_staff_profile_id = ${updatedApplication.convertedStaffProfileId},
        approval_email_status = ${updatedApplication.approvalEmailStatus},
        approval_email_last_attempt_at = ${updatedApplication.approvalEmailLastAttemptAt},
        approval_email_error = ${updatedApplication.approvalEmailError},
        password_setup_token_id = ${updatedApplication.passwordSetupTokenId}
      where id = ${applicationId}
    `;

    return updatedApplication;
  }

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
