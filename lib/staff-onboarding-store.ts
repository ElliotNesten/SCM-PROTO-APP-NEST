import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { StaffOnboardingRecord } from "@/types/job-applications";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-onboarding-store.json");

async function ensureStaffOnboardingStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify([], null, 2), "utf8");
  }
}

async function readStaffOnboardingStore() {
  await ensureStaffOnboardingStore();
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw) as StaffOnboardingRecord[];
}

async function writeStaffOnboardingStore(records: StaffOnboardingRecord[]) {
  await fs.writeFile(storePath, JSON.stringify(records, null, 2), "utf8");
}

export async function getStaffOnboardingRecordByAccountId(staffAppAccountId: string) {
  const records = await readStaffOnboardingStore();
  return (
    records.find((record) => record.staffAppAccountId === staffAppAccountId) ?? null
  );
}

export async function upsertStaffOnboardingRecord(input: {
  staffProfileId: string;
  staffAppAccountId: string;
  personalNumber: string;
  bankName: string;
  bankAccount: string;
  allergies: string;
  driverLicenseManual: boolean;
  driverLicenseAutomatic: boolean;
}) {
  const records = await readStaffOnboardingStore();
  const recordIndex = records.findIndex(
    (record) => record.staffAppAccountId === input.staffAppAccountId,
  );
  const now = new Date().toISOString();

  if (recordIndex === -1) {
    const createdRecord: StaffOnboardingRecord = {
      id: `onboarding-${randomUUID().slice(0, 8)}`,
      staffProfileId: input.staffProfileId,
      staffAppAccountId: input.staffAppAccountId,
      personalNumber: input.personalNumber.trim(),
      bankName: input.bankName.trim(),
      bankAccount: input.bankAccount.trim(),
      allergies: input.allergies.trim(),
      driverLicenseManual: input.driverLicenseManual,
      driverLicenseAutomatic: input.driverLicenseAutomatic,
      savedAt: now,
      updatedAt: now,
      welcomeAcknowledgedAt: null,
    };

    records.unshift(createdRecord);
    await writeStaffOnboardingStore(records);
    return createdRecord;
  }

  const updatedRecord: StaffOnboardingRecord = {
    ...records[recordIndex],
    staffProfileId: input.staffProfileId,
    personalNumber: input.personalNumber.trim(),
    bankName: input.bankName.trim(),
    bankAccount: input.bankAccount.trim(),
    allergies: input.allergies.trim(),
    driverLicenseManual: input.driverLicenseManual,
    driverLicenseAutomatic: input.driverLicenseAutomatic,
    updatedAt: now,
  };

  records[recordIndex] = updatedRecord;
  await writeStaffOnboardingStore(records);
  return updatedRecord;
}

export async function acknowledgeStaffOnboardingWelcome(staffAppAccountId: string) {
  const records = await readStaffOnboardingStore();
  const recordIndex = records.findIndex(
    (record) => record.staffAppAccountId === staffAppAccountId,
  );

  if (recordIndex === -1) {
    return null;
  }

  records[recordIndex] = {
    ...records[recordIndex],
    updatedAt: new Date().toISOString(),
    welcomeAcknowledgedAt:
      records[recordIndex].welcomeAcknowledgedAt ?? new Date().toISOString(),
  };

  await writeStaffOnboardingStore(records);
  return records[recordIndex];
}
