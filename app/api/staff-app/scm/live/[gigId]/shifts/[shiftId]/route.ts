import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getStoredGigById } from "@/lib/gig-store";
import { getStoredGigTimeReportShifts } from "@/lib/gig-time-report-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import {
  setStoredShiftTimeReportsApprovalState,
  updateStoredShiftAssignment,
} from "@/lib/shift-store";
import { getCurrentStaffAppScmProfile } from "@/lib/staff-app-session";
import type { Assignment } from "@/types/scm";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string; shiftId: string }>;
};

type TimeReportAssignmentPayload = {
  staffId?: string;
  checkedIn?: string | null;
  checkedOut?: string | null;
  lunchProvided?: boolean;
  dinnerProvided?: boolean;
  timeReportApproved?: boolean;
  approveAllTimeReports?: boolean;
  setAllTimeReportsApproved?: boolean;
};

function revalidateTimeReportPaths(gigId: string, shiftId: string) {
  revalidatePath(`/gigs/${gigId}`);
  revalidatePath(`/gigs/${gigId}/shifts/${shiftId}`);
  revalidatePath(`/staff-app/scm/gigs`);
  revalidatePath(`/staff-app/scm/live/${gigId}`);
  revalidatePath(`/staff-app/scm/live/${gigId}/time-report`);
  revalidatePath(`/staff-app/scm/live/${gigId}/shifts/${shiftId}`);
}

function normalizeTimestampPayloadValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return Symbol("invalid");
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function isValidTimestampPayloadValue(value: unknown) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return true;
  }

  return !Number.isNaN(Date.parse(trimmedValue));
}

function hasCompleteTimeEntry(assignment: Pick<Assignment, "checkedIn" | "checkedOut">) {
  return Boolean(assignment.checkedIn?.trim() && assignment.checkedOut?.trim());
}

export async function PATCH(request: Request, context: RouteContext) {
  const { gigId, shiftId } = await context.params;
  const payload = (await request.json().catch(() => null)) as TimeReportAssignmentPayload | null;

  if (!payload) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  const [gig, currentProfile] = await Promise.all([
    getStoredGigById(gigId),
    getCurrentStaffAppScmProfile(),
  ]);

  if (!gig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  if (!currentProfile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessPlatformGig(currentProfile, gig)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (gig.timeReportFinalApprovedAt) {
    return NextResponse.json(
      {
        error:
          "The full time report has already been approved. It cannot be changed later.",
      },
      { status: 400 },
    );
  }

  const bulkApprovalState =
    typeof payload.setAllTimeReportsApproved === "boolean"
      ? payload.setAllTimeReportsApproved
      : payload.approveAllTimeReports === true
        ? true
        : undefined;

  if (bulkApprovalState !== undefined) {
    const timeReportShift = (await getStoredGigTimeReportShifts(gigId)).find(
      (shift) => shift.id === shiftId,
    );

    if (!timeReportShift) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    const confirmedAssignments = timeReportShift.assignments.filter(
      (assignment) => assignment.bookingStatus === "Confirmed",
    );

    if (confirmedAssignments.length === 0) {
      return NextResponse.json(
        { error: "No booked staff found for this time report." },
        { status: 400 },
      );
    }

    if (confirmedAssignments.some((assignment) => !hasCompleteTimeEntry(assignment))) {
      return NextResponse.json(
        {
          error:
            "All booked staff must have both check-in and check-out times before approval changes are allowed.",
        },
        { status: 400 },
      );
    }

    const updatedShift = await setStoredShiftTimeReportsApprovalState(
      gigId,
      shiftId,
      bulkApprovalState,
    );

    if (!updatedShift) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    const refreshedTimeReportShift = (await getStoredGigTimeReportShifts(gigId)).find(
      (shift) => shift.id === shiftId,
    );

    revalidateTimeReportPaths(gigId, shiftId);
    return NextResponse.json({ ok: true, shift: refreshedTimeReportShift ?? updatedShift });
  }

  const staffId = typeof payload.staffId === "string" ? payload.staffId.trim() : "";

  if (!staffId) {
    return NextResponse.json({ error: "Staff member is required." }, { status: 400 });
  }

  const normalizedCheckedIn = normalizeTimestampPayloadValue(payload.checkedIn);
  const normalizedCheckedOut = normalizeTimestampPayloadValue(payload.checkedOut);

  if (
    payload.checkedIn === undefined &&
    payload.checkedOut === undefined &&
    payload.lunchProvided === undefined &&
    payload.dinnerProvided === undefined &&
    payload.timeReportApproved === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update for this assignment." }, { status: 400 });
  }

  if (
    !isValidTimestampPayloadValue(payload.checkedIn) ||
    !isValidTimestampPayloadValue(payload.checkedOut) ||
    typeof normalizedCheckedIn === "symbol" ||
    typeof normalizedCheckedOut === "symbol"
  ) {
    return NextResponse.json({ error: "Invalid time value." }, { status: 400 });
  }

  if (
    (payload.lunchProvided !== undefined && typeof payload.lunchProvided !== "boolean") ||
    (payload.dinnerProvided !== undefined && typeof payload.dinnerProvided !== "boolean") ||
    (payload.timeReportApproved !== undefined &&
      typeof payload.timeReportApproved !== "boolean")
  ) {
    return NextResponse.json({ error: "Invalid assignment field value." }, { status: 400 });
  }

  const timeReportShift = (await getStoredGigTimeReportShifts(gigId)).find(
    (shift) => shift.id === shiftId,
  );
  const currentAssignment = timeReportShift?.assignments.find(
    (assignment) => assignment.staffId === staffId,
  );

  if (!currentAssignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  if (payload.timeReportApproved !== undefined) {
    const nextCheckedIn =
      normalizedCheckedIn === undefined ? currentAssignment.checkedIn : normalizedCheckedIn ?? undefined;
    const nextCheckedOut =
      normalizedCheckedOut === undefined ? currentAssignment.checkedOut : normalizedCheckedOut ?? undefined;

    if (!hasCompleteTimeEntry({ checkedIn: nextCheckedIn, checkedOut: nextCheckedOut })) {
      return NextResponse.json(
        {
          error:
            "Both check-in and check-out times are required before a time report can be approved or disapproved.",
        },
        { status: 400 },
      );
    }
  }

  let updatedShift: Awaited<ReturnType<typeof updateStoredShiftAssignment>> | null = null;

  try {
    updatedShift = await updateStoredShiftAssignment(gigId, shiftId, staffId, {
      checkedIn:
        normalizedCheckedIn === undefined || typeof normalizedCheckedIn === "symbol"
          ? undefined
          : normalizedCheckedIn,
      checkedOut:
        normalizedCheckedOut === undefined || typeof normalizedCheckedOut === "symbol"
          ? undefined
          : normalizedCheckedOut,
      lunchProvided: payload.lunchProvided,
      dinnerProvided: payload.dinnerProvided,
      timeReportApproved: payload.timeReportApproved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the shift assignment.",
      },
      { status: 400 },
    );
  }

  if (!updatedShift) {
    return NextResponse.json({ error: "Shift not found." }, { status: 404 });
  }

  const refreshedTimeReportShift = (await getStoredGigTimeReportShifts(gigId)).find(
    (shift) => shift.id === shiftId,
  );

  revalidateTimeReportPaths(gigId, shiftId);
  return NextResponse.json({ ok: true, shift: refreshedTimeReportShift ?? updatedShift });
}
