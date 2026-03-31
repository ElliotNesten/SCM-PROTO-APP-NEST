import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import { getGigCloseoutChecklist } from "@/lib/gig-closeout";
import {
  closeStoredGig,
  getStoredGigById,
  reopenStoredGig,
  updateStoredGigEconomy,
} from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

type CloseoutPatchPayload = {
  invoicesPaid?: boolean;
  economyComment?: string;
};

type CloseoutPostPayload = {
  override?: boolean;
  missingMandatoryPartsAcknowledged?: boolean;
};

async function getAuthorizedGig(gigId: string) {
  const [gig, currentProfile] = await Promise.all([
    getStoredGigById(gigId),
    getCurrentAuthenticatedScmStaffProfile(),
  ]);

  if (!gig) {
    return {
      error: NextResponse.json({ error: "Gig not found." }, { status: 404 }),
    };
  }

  if (!currentProfile) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  if (!canAccessPlatformGig(currentProfile, gig)) {
    return {
      error: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { gig, currentProfile };
}

function revalidateGigCloseoutPaths(gigId: string) {
  revalidatePath("/gigs");
  revalidatePath("/dashboard");
  revalidatePath(`/gigs/${gigId}`);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const authorization = await getAuthorizedGig(gigId);

  if ("error" in authorization) {
    return authorization.error;
  }

  const payload = (await request.json().catch(() => null)) as CloseoutPatchPayload | null;

  if (
    !payload ||
    (payload.invoicesPaid === undefined && payload.economyComment === undefined)
  ) {
    return NextResponse.json({ error: "Choose a valid economy update." }, { status: 400 });
  }

  if (
    payload.invoicesPaid !== undefined &&
    typeof payload.invoicesPaid !== "boolean"
  ) {
    return NextResponse.json({ error: "Choose a valid invoices state." }, { status: 400 });
  }

  if (
    payload.economyComment !== undefined &&
    typeof payload.economyComment !== "string"
  ) {
    return NextResponse.json({ error: "Choose a valid economy comment." }, { status: 400 });
  }

  if (authorization.gig.status === "Closed") {
    return NextResponse.json({ error: "This gig is already closed." }, { status: 400 });
  }

  const updatedGig = await updateStoredGigEconomy(gigId, {
    invoicesPaid: payload.invoicesPaid,
    economyComment: payload.economyComment,
  });

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  revalidateGigCloseoutPaths(gigId);

  return NextResponse.json({
    ok: true,
    gig: updatedGig,
    checklist: getGigCloseoutChecklist(updatedGig),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const authorization = await getAuthorizedGig(gigId);

  if ("error" in authorization) {
    return authorization.error;
  }

  const payload = (await request.json().catch(() => null)) as CloseoutPostPayload | null;
  const override = payload?.override === true;
  const missingMandatoryPartsAcknowledged =
    payload?.missingMandatoryPartsAcknowledged === true;
  const checklist = getGigCloseoutChecklist(authorization.gig);

  if (authorization.gig.status === "Closed") {
    return NextResponse.json({
      ok: true,
      gig: authorization.gig,
      checklist,
    });
  }

  if (!override && !checklist.allRequiredComplete) {
    return NextResponse.json(
      {
        error:
          "Complete the mandatory reports requirements before closing the gig, or use override in Reports.",
        checklist,
      },
      { status: 400 },
    );
  }

  if (override && !missingMandatoryPartsAcknowledged) {
    return NextResponse.json(
      {
        error:
          "Confirm that the mandatory parts do not exist for this gig before using override close.",
        checklist,
      },
      { status: 400 },
    );
  }

  const updatedGig = await closeStoredGig(gigId, {
    overrideUsed: override,
    closedByProfileId: authorization.currentProfile.id,
    closedByName: authorization.currentProfile.displayName,
  });

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  revalidateGigCloseoutPaths(gigId);

  return NextResponse.json({
    ok: true,
    gig: updatedGig,
    checklist: getGigCloseoutChecklist(updatedGig),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const authorization = await getAuthorizedGig(gigId);

  if ("error" in authorization) {
    return authorization.error;
  }

  if (!isSuperAdminRole(authorization.currentProfile.roleKey)) {
    return NextResponse.json(
      { error: "Only Super Admin can reopen a closed gig." },
      { status: 403 },
    );
  }

  if (authorization.gig.status !== "Closed") {
    return NextResponse.json(
      { error: "This gig is not closed." },
      { status: 400 },
    );
  }

  const updatedGig = await reopenStoredGig(gigId);

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  revalidateGigCloseoutPaths(gigId);

  return NextResponse.json({
    ok: true,
    gig: updatedGig,
    checklist: getGigCloseoutChecklist(updatedGig),
  });
}
