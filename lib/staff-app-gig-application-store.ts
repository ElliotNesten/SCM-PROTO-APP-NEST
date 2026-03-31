import fs from "node:fs/promises";
import path from "node:path";

import { buildStaffAppOpenPassId } from "@/lib/staff-app-pass-ids";
import { getAllStaffAppAccounts } from "@/lib/staff-app-store";
import type { StaffAppAccount } from "@/types/staff-app";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-app-gig-application-store.json");

export type StaffAppGigApplicationRecord = {
  accountId: string;
  passId: string;
  appliedAt: string;
};

async function ensureStaffAppGigApplicationStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, "[]", "utf8");
  }
}

async function readStaffAppGigApplicationStore() {
  await ensureStaffAppGigApplicationStore();
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw) as StaffAppGigApplicationRecord[];
}

async function writeStaffAppGigApplicationStore(records: StaffAppGigApplicationRecord[]) {
  await fs.writeFile(storePath, JSON.stringify(records, null, 2), "utf8");
}

export async function getAllStaffAppGigApplications() {
  return readStaffAppGigApplicationStore();
}

export async function getStaffAppGigApplicationsForPasses(passIds: string[]) {
  const normalizedPassIds = new Set(passIds.map((passId) => passId.trim()).filter(Boolean));

  if (normalizedPassIds.size === 0) {
    return [] as StaffAppGigApplicationRecord[];
  }

  const records = await readStaffAppGigApplicationStore();
  return records.filter((record) => normalizedPassIds.has(record.passId));
}

export function getShiftApplicantAppliedAtByStaffProfileId(
  shiftId: string,
  applications: StaffAppGigApplicationRecord[],
  staffAppAccounts: StaffAppAccount[],
) {
  const shiftPassId = buildStaffAppOpenPassId(shiftId);
  const staffAppAccountById = new Map(
    staffAppAccounts.map((account) => [account.id, account]),
  );
  const applicantAppliedAtByStaffId = new Map<string, string>();

  for (const application of applications) {
    if (application.passId !== shiftPassId) {
      continue;
    }

    const linkedStaffProfileId =
      staffAppAccountById.get(application.accountId)?.linkedStaffProfileId?.trim() ??
      "";

    if (!linkedStaffProfileId) {
      continue;
    }

    const currentAppliedAt = applicantAppliedAtByStaffId.get(linkedStaffProfileId);

    if (!currentAppliedAt || application.appliedAt > currentAppliedAt) {
      applicantAppliedAtByStaffId.set(linkedStaffProfileId, application.appliedAt);
    }
  }

  return applicantAppliedAtByStaffId;
}

export async function getStaffAppGigApplication(accountId: string, passId: string) {
  const records = await readStaffAppGigApplicationStore();
  return (
    records.find((record) => record.accountId === accountId && record.passId === passId) ??
    null
  );
}

export async function applyToStaffAppGig(accountId: string, passId: string) {
  const records = await readStaffAppGigApplicationStore();
  const existingRecord = records.find(
    (record) => record.accountId === accountId && record.passId === passId,
  );

  if (existingRecord) {
    return existingRecord;
  }

  const record: StaffAppGigApplicationRecord = {
    accountId,
    passId,
    appliedAt: new Date().toISOString(),
  };

  records.push(record);
  await writeStaffAppGigApplicationStore(records);
  return record;
}

export async function hasStaffAppGigApplicationForShiftAndStaffProfile(
  shiftId: string,
  staffProfileId: string,
) {
  const [applications, staffAppAccounts] = await Promise.all([
    readStaffAppGigApplicationStore(),
    getAllStaffAppAccounts(),
  ]);

  return getShiftApplicantAppliedAtByStaffProfileId(
    shiftId,
    applications,
    staffAppAccounts,
  ).has(staffProfileId);
}
