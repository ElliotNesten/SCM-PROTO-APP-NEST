import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import {
  assignStoredGigTemporaryManager,
  getGigTemporaryManagerTimeline,
  getStoredGigById,
  removeStoredGigTemporaryManager,
} from "@/lib/gig-store";
import { canAccessPlatformGig, canManageGigShare } from "@/lib/platform-access";
import { ensureStaffAppAccountForLinkedStaffProfile } from "@/lib/staff-app-store";
import { getAllStoredStaffProfiles, getStoredStaffProfileById } from "@/lib/staff-store";
import type { Gig } from "@/types/scm";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

type TemporaryGigManagerPayload = {
  staffProfileId?: string;
};

type ResolvedTemporaryGigManager = {
  staffProfileId: string;
  displayName: string;
  email: string;
  country: string;
  region: string;
  assignedAt: string;
  platformAccessEndsOn: string;
  visibleUntil: string;
};

function resolveTemporaryGigManagers(
  gig: Gig,
  staffProfiles: Awaited<ReturnType<typeof getAllStoredStaffProfiles>>,
) {
  const timeline = getGigTemporaryManagerTimeline(gig.date);

  return (gig.temporaryGigManagers ?? [])
    .map((assignment) => {
      const linkedStaffProfile = staffProfiles.find(
        (staffProfile) => staffProfile.id === assignment.staffProfileId,
      );

      if (!linkedStaffProfile) {
        return null;
      }

      return {
        staffProfileId: linkedStaffProfile.id,
        displayName: linkedStaffProfile.displayName,
        email: linkedStaffProfile.email,
        country: linkedStaffProfile.country,
        region: linkedStaffProfile.region,
        assignedAt: assignment.assignedAt,
        platformAccessEndsOn: timeline.platformAccessEndsOn,
        visibleUntil: timeline.visibleUntil,
      };
    })
    .filter((entry): entry is ResolvedTemporaryGigManager => Boolean(entry));
}

async function getAuthorizedGig(gigId: string) {
  const [gig, currentProfile] = await Promise.all([
    getStoredGigById(gigId),
    getCurrentAuthenticatedScmStaffProfile(),
  ]);

  if (!gig) {
    return {
      errorResponse: NextResponse.json({ error: "Gig not found." }, { status: 404 }),
    };
  }

  if (!currentProfile) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  if (!canAccessPlatformGig(currentProfile, gig) || !canManageGigShare(currentProfile.roleKey)) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return {
    gig,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const authorization = await getAuthorizedGig(gigId);

  if ("errorResponse" in authorization) {
    return authorization.errorResponse;
  }

  const payload = (await request.json().catch(() => null)) as TemporaryGigManagerPayload | null;
  const staffProfileId = payload?.staffProfileId?.trim() ?? "";

  if (!staffProfileId) {
    return NextResponse.json({ error: "Choose a staff member first." }, { status: 400 });
  }

  const staffProfile = await getStoredStaffProfileById(staffProfileId);

  if (!staffProfile) {
    return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  }

  await ensureStaffAppAccountForLinkedStaffProfile({
    id: staffProfile.id,
    displayName: staffProfile.displayName,
    email: staffProfile.email,
    phone: staffProfile.phone,
    country: staffProfile.country,
    region: staffProfile.region,
    roleProfiles: staffProfile.roleProfiles,
    roles: staffProfile.roles,
    priority: staffProfile.priority,
    profileImageUrl: staffProfile.profileImageUrl,
  });

  const updatedGig = await assignStoredGigTemporaryManager(gigId, staffProfileId);

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  const staffProfiles = await getAllStoredStaffProfiles();

  return NextResponse.json({
    ok: true,
    temporaryGigManagers: resolveTemporaryGigManagers(updatedGig, staffProfiles),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const authorization = await getAuthorizedGig(gigId);

  if ("errorResponse" in authorization) {
    return authorization.errorResponse;
  }

  const payload = (await request.json().catch(() => null)) as TemporaryGigManagerPayload | null;
  const staffProfileId = payload?.staffProfileId?.trim() ?? "";

  if (!staffProfileId) {
    return NextResponse.json({ error: "Choose a staff member first." }, { status: 400 });
  }

  const updatedGig = await removeStoredGigTemporaryManager(gigId, staffProfileId);

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  const staffProfiles = await getAllStoredStaffProfiles();

  return NextResponse.json({
    ok: true,
    temporaryGigManagers: resolveTemporaryGigManagers(updatedGig, staffProfiles),
  });
}
