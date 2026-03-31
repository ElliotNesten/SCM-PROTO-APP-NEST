import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getStoredGigById } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import { appendReplyToShiftCommunicationThread } from "@/lib/shift-communication-replies";
import {
  getStoredShiftCommunicationThreadById,
} from "@/lib/shift-communication-store";
import {
  getCurrentStaffAppAccount,
  getCurrentStaffAppScmProfile,
} from "@/lib/staff-app-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string; threadId: string }>;
};

type ParsedReplyPayload = {
  body: string;
  attachments: File[];
};

async function parseReplyPayload(request: Request): Promise<ParsedReplyPayload> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    return {
      body: typeof formData.get("body") === "string" ? String(formData.get("body")).trim() : "",
      attachments: formData
        .getAll("attachment")
        .filter((entry): entry is File => entry instanceof File)
        .filter((entry) => entry.size > 0),
    };
  }

  const payload = (await request.json().catch(() => null)) as { body?: string } | null;

  return {
    body: typeof payload?.body === "string" ? payload.body.trim() : "",
    attachments: [],
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { gigId, threadId } = await context.params;
  const gig = await getStoredGigById(gigId);

  if (!gig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  const [platformProfile, staffAppAccount, staffAppScmProfile, thread] =
    await Promise.all([
      getCurrentAuthenticatedScmStaffProfile(),
      getCurrentStaffAppAccount(),
      getCurrentStaffAppScmProfile(),
      getStoredShiftCommunicationThreadById(gigId, threadId),
    ]);

  if (!thread) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const hasPlatformAccess = Boolean(
    (platformProfile && canAccessPlatformGig(platformProfile, gig)) ||
      (staffAppScmProfile && canAccessPlatformGig(staffAppScmProfile, gig)),
  );
  const hasAuthenticatedSession = Boolean(
    platformProfile || staffAppAccount || staffAppScmProfile,
  );
  const linkedStaffId = staffAppAccount?.linkedStaffProfileId?.trim() ?? "";
  const isStaffParticipant =
    linkedStaffId.length > 0 && thread.target.recipientIds.includes(linkedStaffId);

  if (!hasAuthenticatedSession) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!hasPlatformAccess && !isStaffParticipant) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!hasPlatformAccess && !thread.target.allowReplies) {
    return NextResponse.json(
      { error: "Replies are turned off for this conversation." },
      { status: 403 },
    );
  }

  const payload = await parseReplyPayload(request);

  const author =
    platformProfile && canAccessPlatformGig(platformProfile, gig)
      ? {
          authorName: platformProfile.displayName,
          authorProfileId: platformProfile.id,
          authorType: "scm" as const,
        }
      : staffAppScmProfile && canAccessPlatformGig(staffAppScmProfile, gig)
        ? {
            authorName: staffAppScmProfile.displayName,
            authorProfileId: staffAppScmProfile.id,
            authorType: "scm" as const,
          }
        : {
            authorName: staffAppAccount?.displayName ?? "Staff member",
            authorProfileId: linkedStaffId,
            authorType: "staff" as const,
          };

  try {
    const { state } = await appendReplyToShiftCommunicationThread({
      gigId,
      threadId,
      body: payload.body,
      attachments: payload.attachments,
      ...author,
    });

    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not add the reply.";
    const status =
      message.includes("supported") || message.includes("Write a reply")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
