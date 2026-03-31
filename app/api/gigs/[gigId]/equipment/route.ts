import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getStoredGigById, updateStoredGigEquipment } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import type { GigEquipmentItem } from "@/types/scm";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const gig = await getStoredGigById(gigId);

  if (!gig) {
    return NextResponse.json({ error: "Gig not found" }, { status: 404 });
  }

  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessPlatformGig(currentProfile, gig)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const payload = (await request.json()) as { equipment?: GigEquipmentItem[] };
  const updatedGig = await updateStoredGigEquipment(gigId, payload.equipment ?? []);

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, equipment: updatedGig.equipment ?? [] });
}
