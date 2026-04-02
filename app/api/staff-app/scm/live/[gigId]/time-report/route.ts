import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getStoredGigById,
  setStoredGigTimeReportFinalApproval,
} from "@/lib/gig-store";
import { getStoredGigTimeReportShifts } from "@/lib/gig-time-report-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import { getCurrentStaffAppScmProfile } from "@/lib/staff-app-session";
import {
  buildStoredStaffDocumentRecord,
  replaceStoredStaffDocumentsForGig,
} from "@/lib/staff-document-store";
import type { Assignment } from "@/types/scm";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

function hasCompleteTimeEntry(assignment: Pick<Assignment, "checkedIn" | "checkedOut">) {
  return Boolean(assignment.checkedIn?.trim() && assignment.checkedOut?.trim());
}

function revalidateTimeReportPaths(gigId: string) {
  revalidatePath(`/gigs/${gigId}`);
  revalidatePath(`/staff-app/scm/gigs`);
  revalidatePath(`/staff-app/scm/live/${gigId}`);
  revalidatePath(`/staff-app/scm/live/${gigId}/time-report`);
}

export async function POST(_request: Request, context: RouteContext) {
  const { gigId } = await context.params;
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

  const timeReportShifts = await getStoredGigTimeReportShifts(gigId);
  const confirmedEntries = timeReportShifts.flatMap((shift) =>
    shift.assignments
      .filter((assignment) => assignment.bookingStatus === "Confirmed")
      .map((assignment) => ({ shift, assignment })),
  );

  if (confirmedEntries.length === 0) {
    return NextResponse.json(
      { error: "No booked staff were found for this time report." },
      { status: 400 },
    );
  }

  if (confirmedEntries.some(({ assignment }) => !hasCompleteTimeEntry(assignment))) {
    return NextResponse.json(
      {
        error:
          "All booked staff must have both check-in and check-out times before the full time report can be approved.",
      },
      { status: 400 },
    );
  }

  if (confirmedEntries.some(({ assignment }) => assignment.timeReportApproved !== true)) {
    return NextResponse.json(
      {
        error:
          "Approve every booked pass in the time report before you approve the full time report.",
      },
      { status: 400 },
    );
  }

  try {
    const approvedAt = new Date().toISOString();
    const generatedDocuments = await Promise.all(
      confirmedEntries.flatMap(({ shift, assignment }) => [
        buildStoredStaffDocumentRecord({
          userId: assignment.staffId,
          gigId: gig.id,
          shiftId: shift.id,
          gigName: gig.artist,
          gigDate: gig.date,
          shiftRole: shift.role,
          documentKind: "Employment Contract",
          generatedAt: approvedAt,
        }),
        buildStoredStaffDocumentRecord({
          userId: assignment.staffId,
          gigId: gig.id,
          shiftId: shift.id,
          gigName: gig.artist,
          gigDate: gig.date,
          shiftRole: shift.role,
          documentKind: "Time Report",
          generatedAt: approvedAt,
        }),
      ]),
    );

    await Promise.all([
      replaceStoredStaffDocumentsForGig(gig.id, generatedDocuments),
      setStoredGigTimeReportFinalApproval(gig.id, approvedAt),
    ]);

    revalidateTimeReportPaths(gig.id);
    return NextResponse.json({
      ok: true,
      approvedAt,
      generatedDocumentCount: generatedDocuments.length,
    });
  } catch (error) {
    console.error(
      `[staff-app-time-report] Could not finalize the full time report for gig ${gig.id}.`,
      error,
    );

    return NextResponse.json(
      {
        error:
          "Could not generate and save the Employment Contracts and Time Reports for this gig.",
      },
      { status: 500 },
    );
  }
}
