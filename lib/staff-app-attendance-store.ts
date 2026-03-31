import fs from "node:fs/promises";
import path from "node:path";

import { getStaffAppSchedule } from "@/lib/staff-app-data";
import type {
  StaffAppAccount,
  StaffAppAttendanceRecord,
  StaffAppScheduledShift,
} from "@/types/staff-app";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-app-attendance-store.json");

export type StaffAppAttendanceState = {
  todayShift: StaffAppScheduledShift | null;
  nextShift: StaffAppScheduledShift | null;
  record: StaffAppAttendanceRecord | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
};

function getStockholmDateKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function ensureStaffAppAttendanceStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, "[]", "utf8");
  }
}

async function readStaffAppAttendanceStore() {
  await ensureStaffAppAttendanceStore();
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw) as StaffAppAttendanceRecord[];
}

async function writeStaffAppAttendanceStore(records: StaffAppAttendanceRecord[]) {
  await fs.writeFile(storePath, JSON.stringify(records, null, 2), "utf8");
}

export async function getAllStaffAppAttendanceRecords() {
  return readStaffAppAttendanceStore();
}

export function isStaffAppShiftToday(shiftDate: string) {
  return shiftDate === getStockholmDateKey();
}

export async function getStaffAppAttendanceRecord(accountId: string, shiftId: string) {
  const records = await readStaffAppAttendanceStore();
  return (
    records.find((record) => record.accountId === accountId && record.shiftId === shiftId) ?? null
  );
}

export async function checkInToStaffAppShift(accountId: string, shiftId: string) {
  const records = await readStaffAppAttendanceStore();
  const recordIndex = records.findIndex(
    (record) => record.accountId === accountId && record.shiftId === shiftId,
  );
  const checkedInAt = new Date().toISOString();

  if (recordIndex === -1) {
    const record: StaffAppAttendanceRecord = {
      accountId,
      shiftId,
      checkedInAt,
    };

    records.push(record);
    await writeStaffAppAttendanceStore(records);
    return record;
  }

  if (!records[recordIndex].checkedInAt) {
    records[recordIndex] = {
      ...records[recordIndex],
      checkedInAt,
    };
    await writeStaffAppAttendanceStore(records);
  }

  return records[recordIndex];
}

export async function checkOutFromStaffAppShift(accountId: string, shiftId: string) {
  const records = await readStaffAppAttendanceStore();
  const recordIndex = records.findIndex(
    (record) => record.accountId === accountId && record.shiftId === shiftId,
  );

  if (recordIndex === -1 || !records[recordIndex].checkedInAt) {
    return null;
  }

  if (!records[recordIndex].checkedOutAt) {
    records[recordIndex] = {
      ...records[recordIndex],
      checkedOutAt: new Date().toISOString(),
    };
    await writeStaffAppAttendanceStore(records);
  }

  return records[recordIndex];
}

export async function getStaffAppAttendanceState(
  account: StaffAppAccount,
): Promise<StaffAppAttendanceState> {
  const schedule = await getStaffAppSchedule(account);
  const todayShift = schedule.find((shift) => isStaffAppShiftToday(shift.date)) ?? null;
  const nextShift = schedule[0] ?? null;

  if (!todayShift) {
    return {
      todayShift: null,
      nextShift,
      record: null,
      checkedInAt: null,
      checkedOutAt: null,
      canCheckIn: false,
      canCheckOut: false,
    };
  }

  const record = await getStaffAppAttendanceRecord(account.id, todayShift.id);
  const checkedInAt = record?.checkedInAt ?? null;
  const checkedOutAt = record?.checkedOutAt ?? null;

  return {
    todayShift,
    nextShift,
    record,
    checkedInAt,
    checkedOutAt,
    canCheckIn: !checkedInAt && !checkedOutAt,
    canCheckOut: Boolean(checkedInAt) && !checkedOutAt,
  };
}
