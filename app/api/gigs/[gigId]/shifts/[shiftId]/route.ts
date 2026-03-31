import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getStoredGigById } from "@/lib/gig-store";
import { getStoredGigTimeReportShifts } from "@/lib/gig-time-report-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import {
  deleteStoredShift,
  getStoredShiftById,
  getStoredGigShifts,
  isStaffEligibleForShift,
  setStoredShiftTimeReportsApprovalState,
  updateStoredShift,
  updateStoredShiftAssignment,
} from "@/lib/shift-store";
import { hasStaffAppGigApplicationForShiftAndStaffProfile } from "@/lib/staff-app-gig-application-store";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import type { Assignment, BookingStatus } from "@/types/scm";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string; shiftId: string }>;
};

type ShiftAssignmentPayload = {
  staffId?: string;
  bookingStatus?: BookingStatus | null;
  checkedIn?: string | null;
  checkedOut?: string | null;
  lunchProvided?: boolean;
  dinnerProvided?: boolean;
  timeReportApproved?: boolean;
  approveAllTimeReports?: boolean;
  setAllTimeReportsApproved?: boolean;
  role?: string;
  customRole?: string;
  priorityLevel?: number;
  requiredStaff?: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
};

const validRoles = new Set(["Stand Leader", "Seller", "Runner", "Other"]);

function isValidTime(value: string | undefined) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function revalidateShiftPaths(gigId: string, shiftId: string) {
  revalidatePath(`/gigs/${gigId}`);
  revalidatePath(`/gigs/${gigId}/shifts/${shiftId}`);
  revalidatePath("/staff-app/gigs");
  revalidatePath("/staff-app/gigs/open");
  revalidatePath("/staff-app/gigs/standby");
  revalidatePath("/staff-app/gigs/unassigned");
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

function resolveRequestedShiftRole(payload: ShiftAssignmentPayload) {
  if (!payload.role) {
    return null;
  }

  if (!validRoles.has(payload.role)) {
    return Symbol("invalid-role");
  }

  if (payload.role === "Other") {
    const customRole = payload.customRole?.trim();
    return customRole ? customRole : Symbol("missing-custom-role");
  }

  return payload.role.trim();
}

export async function PATCH(request: Request, context: RouteContext) {
  const { gigId, shiftId } = await context.params;
  const payload = (await request.json().catch(() => null)) as ShiftAssignmentPayload | null;

  if (!payload) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  const [gig, currentProfile] = await Promise.all([
    getStoredGigById(gigId),
    getCurrentAuthenticatedScmStaffProfile(),
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

    revalidateShiftPaths(gigId, shiftId);
    return NextResponse.json({ ok: true, shift: refreshedTimeReportShift ?? updatedShift });
  }

  if (payload.staffId) {
    if (gig.overviewIndicator === "noMerch") {
      return NextResponse.json(
        {
          error:
            "This gig is marked as No merch. All shift passes are closed until the gig is reopened.",
        },
        { status: 400 },
      );
    }

    const normalizedCheckedIn = normalizeTimestampPayloadValue(payload.checkedIn);
    const normalizedCheckedOut = normalizeTimestampPayloadValue(payload.checkedOut);

    if (
      payload.bookingStatus === undefined &&
      payload.checkedIn === undefined &&
      payload.checkedOut === undefined &&
      payload.lunchProvided === undefined &&
      payload.dinnerProvided === undefined &&
      payload.timeReportApproved === undefined
    ) {
      return NextResponse.json({ error: "Nothing to update for this assignment." }, { status: 400 });
    }

    if (
      payload.bookingStatus !== null &&
      payload.bookingStatus !== undefined &&
      payload.bookingStatus !== "Confirmed" &&
      payload.bookingStatus !== "Pending" &&
      payload.bookingStatus !== "Waitlisted"
    ) {
      return NextResponse.json({ error: "Invalid booking status." }, { status: 400 });
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
      (payload.lunchProvided !== undefined &&
        typeof payload.lunchProvided !== "boolean") ||
      (payload.dinnerProvided !== undefined &&
        typeof payload.dinnerProvided !== "boolean") ||
      (payload.timeReportApproved !== undefined &&
        typeof payload.timeReportApproved !== "boolean")
    ) {
      return NextResponse.json({ error: "Invalid assignment field value." }, { status: 400 });
    }

    const [currentShift, timeReportShifts] = await Promise.all([
      getStoredShiftById(shiftId),
      getStoredGigTimeReportShifts(gigId),
    ]);

    if (!currentShift || currentShift.gigId !== gigId) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    const currentTimeReportShift = timeReportShifts.find((shift) => shift.id === shiftId);
    const currentTimeReportAssignment = currentTimeReportShift?.assignments.find(
      (assignment) => assignment.staffId === payload.staffId,
    );
    const hasExistingAssignment = currentShift.assignments.some(
      (assignment) => assignment.staffId === payload.staffId,
    );

    if (
      payload.bookingStatus !== null &&
      payload.bookingStatus !== undefined &&
      !hasExistingAssignment
    ) {
      const staffProfile = await getStoredStaffProfileById(payload.staffId);

      if (!staffProfile) {
        return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
      }

      const [matchesShiftRequirements, hasDirectApplication] = await Promise.all([
        Promise.resolve(isStaffEligibleForShift(staffProfile, gig, currentShift)),
        hasStaffAppGigApplicationForShiftAndStaffProfile(shiftId, staffProfile.id),
      ]);

      if (!matchesShiftRequirements && !hasDirectApplication) {
        return NextResponse.json(
          {
            error:
              "This staff member has not applied for this shift and does not match the shift role, country, region, or priority level.",
          },
          { status: 400 },
        );
      }
    }

    if (
      payload.bookingStatus === undefined &&
      !hasExistingAssignment
    ) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    if (payload.timeReportApproved !== undefined) {
      const nextCheckedIn =
        normalizedCheckedIn === undefined
          ? currentTimeReportAssignment?.checkedIn
          : normalizedCheckedIn ?? undefined;
      const nextCheckedOut =
        normalizedCheckedOut === undefined
          ? currentTimeReportAssignment?.checkedOut
          : normalizedCheckedOut ?? undefined;

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

    let updatedShift: Awaited<ReturnType<typeof updateStoredShiftAssignment>> | null =
      null;

    try {
      updatedShift = await updateStoredShiftAssignment(
        gigId,
        shiftId,
        payload.staffId,
        {
          bookingStatus: payload.bookingStatus,
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
        },
      );
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

    revalidateShiftPaths(gigId, shiftId);
    return NextResponse.json({ ok: true, shift: refreshedTimeReportShift ?? updatedShift });
  }

  const currentShift = await getStoredShiftById(shiftId);

  if (!currentShift || currentShift.gigId !== gigId) {
    return NextResponse.json({ error: "Shift not found." }, { status: 404 });
  }

  const requestedRole = resolveRequestedShiftRole(payload);

  if (typeof requestedRole === "symbol") {
    if (requestedRole.description === "invalid-role") {
      return NextResponse.json({ error: "Invalid shift role." }, { status: 400 });
    }

    return NextResponse.json({ error: "Missing custom shift name." }, { status: 400 });
  }

  if (requestedRole && requestedRole !== currentShift.role) {
    return NextResponse.json(
      { error: "Shift role can only be set when creating a new shift." },
      { status: 400 },
    );
  }

  if (!isValidTime(payload.startTime) || !isValidTime(payload.endTime)) {
    return NextResponse.json({ error: "Invalid shift time." }, { status: 400 });
  }

  const requiredStaff = Number(payload.requiredStaff);
  const priorityLevel = Number(payload.priorityLevel);

  if (!Number.isFinite(requiredStaff) || requiredStaff < 1) {
    return NextResponse.json({ error: "Required staff must be at least 1." }, { status: 400 });
  }

  if (!Number.isFinite(priorityLevel) || priorityLevel < 1 || priorityLevel > 5) {
    return NextResponse.json({ error: "Priority level must be between 1 and 5." }, { status: 400 });
  }

  const updatedShift = await updateStoredShift(gigId, shiftId, {
    priorityLevel,
    requiredStaff,
    startTime: payload.startTime as string,
    endTime: payload.endTime as string,
    notes: payload.notes,
  });

  if (!updatedShift) {
    return NextResponse.json({ error: "Shift not found." }, { status: 404 });
  }

  const shifts = await getStoredGigShifts(gigId);

  revalidateShiftPaths(gigId, shiftId);
  return NextResponse.json({ ok: true, shift: updatedShift, shifts });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { gigId, shiftId } = await context.params;
  const [gig, currentProfile] = await Promise.all([
    getStoredGigById(gigId),
    getCurrentAuthenticatedScmStaffProfile(),
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

  const deleted = await deleteStoredShift(gigId, shiftId);

  if (!deleted) {
    return NextResponse.json({ error: "Shift not found." }, { status: 404 });
  }

  const shifts = await getStoredGigShifts(gigId);
  revalidateShiftPaths(gigId, shiftId);
  return NextResponse.json({ ok: true, shifts });
}
