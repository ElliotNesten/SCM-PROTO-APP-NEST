import { getAllStaffAppAttendanceRecords } from "@/lib/staff-app-attendance-store";
import { getStaffAppSchedule } from "@/lib/staff-app-data";
import { getAllStaffAppAccounts } from "@/lib/staff-app-store";
import { getStoredGigShifts } from "@/lib/shift-store";
import type { Shift } from "@/types/scm";

type AttendanceSnapshot = {
  staffId: string;
  shiftId: string;
  checkedInAt?: string;
  checkedOutAt?: string;
};

function buildAttendanceKey(shiftId: string, staffId: string) {
  return `${shiftId}:${staffId}`;
}

function mergeAttendanceSnapshots(snapshots: AttendanceSnapshot[]) {
  const mergedByKey = new Map<string, AttendanceSnapshot>();

  snapshots.forEach((snapshot) => {
    const key = buildAttendanceKey(snapshot.shiftId, snapshot.staffId);
    const currentSnapshot = mergedByKey.get(key);

    if (!currentSnapshot) {
      mergedByKey.set(key, snapshot);
      return;
    }

    mergedByKey.set(key, {
      staffId: snapshot.staffId,
      shiftId: snapshot.shiftId,
      checkedInAt: currentSnapshot.checkedInAt ?? snapshot.checkedInAt,
      checkedOutAt: currentSnapshot.checkedOutAt ?? snapshot.checkedOutAt,
    });
  });

  return mergedByKey;
}

export async function getStoredGigTimeReportShifts(gigId: string) {
  const [gigShifts, schedule, accounts, attendanceRecords] = await Promise.all([
    getStoredGigShifts(gigId),
    getStaffAppSchedule(),
    getAllStaffAppAccounts(),
    getAllStaffAppAttendanceRecords(),
  ]);

  const linkedStaffProfileByAccountId = new Map(
    accounts.map((account) => [account.id, account.linkedStaffProfileId?.trim() ?? ""]),
  );
  const underlyingShiftIdByScheduleId = new Map(
    schedule
      .filter((scheduleShift) => scheduleShift.shiftId?.trim())
      .map((scheduleShift) => [scheduleShift.id, scheduleShift.shiftId?.trim() ?? ""]),
  );

  const attendanceLookup = mergeAttendanceSnapshots(
    attendanceRecords.flatMap((record) => {
      const staffId = linkedStaffProfileByAccountId.get(record.accountId)?.trim() ?? "";
      const shiftId = underlyingShiftIdByScheduleId.get(record.shiftId)?.trim() ?? "";

      if (!staffId || !shiftId) {
        return [];
      }

      return [
        {
          staffId,
          shiftId,
          checkedInAt: record.checkedInAt,
          checkedOutAt: record.checkedOutAt,
        } satisfies AttendanceSnapshot,
      ];
    }),
  );

  return gigShifts.map(
    (shift): Shift => ({
      ...shift,
      assignments: shift.assignments.map((assignment) => {
        const attendance = attendanceLookup.get(buildAttendanceKey(shift.id, assignment.staffId));

        if (!attendance) {
          return assignment;
        }

        return {
          ...assignment,
          checkedIn: assignment.checkedIn ?? attendance.checkedInAt,
          checkedOut: assignment.checkedOut ?? attendance.checkedOutAt,
        };
      }),
    }),
  );
}
