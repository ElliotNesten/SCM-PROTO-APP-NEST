import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getStoredGigById } from "@/lib/gig-store";
import {
  canCreateShiftsForGig,
  getGigShiftCreationMessage,
} from "@/lib/gig-shift-access";
import { canAccessPlatformGig } from "@/lib/platform-access";
import { createStoredShift, getStoredGigShifts } from "@/lib/shift-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

type CreateShiftPayload = {
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

export async function POST(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const payload = (await request.json().catch(() => null)) as CreateShiftPayload | null;

  if (!payload?.role || !validRoles.has(payload.role)) {
    return NextResponse.json({ error: "Invalid shift role." }, { status: 400 });
  }

  if (payload.role === "Other" && !payload.customRole?.trim()) {
    return NextResponse.json({ error: "Missing custom shift name." }, { status: 400 });
  }

  if (!isValidTime(payload.startTime) || !isValidTime(payload.endTime)) {
    return NextResponse.json({ error: "Invalid shift time." }, { status: 400 });
  }

  const requiredStaff = Number(payload.requiredStaff);
  const priorityLevel = Number(payload.priorityLevel);
  const startTime = payload.startTime as string;
  const endTime = payload.endTime as string;

  if (!Number.isFinite(requiredStaff) || requiredStaff < 1) {
    return NextResponse.json({ error: "Required staff must be at least 1." }, { status: 400 });
  }

  if (!Number.isFinite(priorityLevel) || priorityLevel < 1 || priorityLevel > 5) {
    return NextResponse.json({ error: "Priority level must be between 1 and 5." }, { status: 400 });
  }

  const gig = await getStoredGigById(gigId);

  if (!gig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

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

  if (!canCreateShiftsForGig(gig)) {
    return NextResponse.json(
      {
        error:
          getGigShiftCreationMessage(gig) ??
          "This gig must be marked as In Progress or Confirmed before shifts can be created.",
      },
      { status: 400 },
    );
  }

  const createdShift = await createStoredShift(gigId, {
    role: payload.role as "Stand Leader" | "Seller" | "Runner" | "Other",
    customRole: payload.customRole,
    priorityLevel,
    requiredStaff,
    startTime,
    endTime,
    notes: payload.notes,
  });
  const shifts = await getStoredGigShifts(gigId);

  revalidateShiftPaths(gigId, createdShift.id);
  return NextResponse.json({ ok: true, shift: createdShift, shifts });
}
