import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureProductionStorageSchema,
  getPostgresClient,
} from "@/lib/postgres";
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

type StaffOnboardingRow = {
  id: string;
  staff_profile_id: string;
  staff_app_account_id: string;
  personal_number: string;
  bank_name: string;
  bank_account: string;
  allergies: string;
  driver_license_manual: boolean;
  driver_license_automatic: boolean;
  saved_at: string;
  updated_at: string;
  welcome_acknowledged_at: string | null;
};

function mapStaffOnboardingRow(row: StaffOnboardingRow): StaffOnboardingRecord {
  return {
    id: row.id,
    staffProfileId: row.staff_profile_id,
    staffAppAccountId: row.staff_app_account_id,
    personalNumber: row.personal_number,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    allergies: row.allergies,
    driverLicenseManual: row.driver_license_manual,
    driverLicenseAutomatic: row.driver_license_automatic,
    savedAt: row.saved_at,
    updatedAt: row.updated_at,
    welcomeAcknowledgedAt: row.welcome_acknowledged_at,
  };
}

export async function getStaffOnboardingRecordByAccountId(staffAppAccountId: string) {
  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<StaffOnboardingRow[]>`
      select *
      from staff_onboarding
      where staff_app_account_id = ${staffAppAccountId}
      limit 1
    `;

    return rows[0] ? mapStaffOnboardingRow(rows[0]) : null;
  }

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
  const sql = getPostgresClient();
  const now = new Date().toISOString();

  if (sql) {
    const currentRecord = await getStaffOnboardingRecordByAccountId(input.staffAppAccountId);
    const nextRecord: StaffOnboardingRecord = currentRecord
      ? {
          ...currentRecord,
          staffProfileId: input.staffProfileId,
          personalNumber: input.personalNumber.trim(),
          bankName: input.bankName.trim(),
          bankAccount: input.bankAccount.trim(),
          allergies: input.allergies.trim(),
          driverLicenseManual: input.driverLicenseManual,
          driverLicenseAutomatic: input.driverLicenseAutomatic,
          updatedAt: now,
        }
      : {
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

    await ensureProductionStorageSchema();
    await sql`
      insert into staff_onboarding (
        id, staff_profile_id, staff_app_account_id, personal_number, bank_name, bank_account,
        allergies, driver_license_manual, driver_license_automatic, saved_at, updated_at,
        welcome_acknowledged_at
      ) values (
        ${nextRecord.id},
        ${nextRecord.staffProfileId},
        ${nextRecord.staffAppAccountId},
        ${nextRecord.personalNumber},
        ${nextRecord.bankName},
        ${nextRecord.bankAccount},
        ${nextRecord.allergies},
        ${nextRecord.driverLicenseManual},
        ${nextRecord.driverLicenseAutomatic},
        ${nextRecord.savedAt},
        ${nextRecord.updatedAt},
        ${nextRecord.welcomeAcknowledgedAt}
      )
      on conflict (staff_app_account_id) do update set
        staff_profile_id = excluded.staff_profile_id,
        personal_number = excluded.personal_number,
        bank_name = excluded.bank_name,
        bank_account = excluded.bank_account,
        allergies = excluded.allergies,
        driver_license_manual = excluded.driver_license_manual,
        driver_license_automatic = excluded.driver_license_automatic,
        updated_at = excluded.updated_at
    `;

    return nextRecord;
  }

  const records = await readStaffOnboardingStore();
  const recordIndex = records.findIndex(
    (record) => record.staffAppAccountId === input.staffAppAccountId,
  );

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
  const sql = getPostgresClient();

  if (sql) {
    const currentRecord = await getStaffOnboardingRecordByAccountId(staffAppAccountId);

    if (!currentRecord) {
      return null;
    }

    const updatedRecord = {
      ...currentRecord,
      updatedAt: new Date().toISOString(),
      welcomeAcknowledgedAt:
        currentRecord.welcomeAcknowledgedAt ?? new Date().toISOString(),
    };

    await ensureProductionStorageSchema();
    await sql`
      update staff_onboarding
      set
        updated_at = ${updatedRecord.updatedAt},
        welcome_acknowledged_at = ${updatedRecord.welcomeAcknowledgedAt}
      where staff_app_account_id = ${staffAppAccountId}
    `;

    return updatedRecord;
  }

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
