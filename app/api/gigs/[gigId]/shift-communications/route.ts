import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getStoredGigById } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import {
  isAllowedShiftMessageAttachment,
  storeShiftMessageAttachments,
} from "@/lib/shift-communication-attachments";
import {
  createStoredShiftMessage,
  createStoredShiftMessageGroup,
  getStoredShiftCommunication,
} from "@/lib/shift-communication-store";
import type { ShiftMessageAudience } from "@/types/scm";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

type ShiftCommunicationJsonPayload =
  | {
      type: "message";
      audience?: ShiftMessageAudience;
      audienceLabel?: string;
      recipientIds?: string[];
      body?: string;
      shiftId?: string;
      groupId?: string;
      allowReplies?: boolean;
    }
  | {
      type: "group";
      name?: string;
      memberIds?: string[];
    };

type ParsedShiftMessagePayload = {
  audience?: ShiftMessageAudience;
  audienceLabel?: string;
  recipientIds: string[];
  body?: string;
  shiftId?: string;
  groupId?: string;
  allowReplies?: boolean;
  attachments: File[];
};

const validAudiences = new Set<ShiftMessageAudience>([
  "bookedOnShift",
  "standLeaders",
  "individualPeople",
  "customGroup",
]);

function parseBooleanFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
}

function parseMessagePayloadFromFormData(formData: FormData): ParsedShiftMessagePayload {
  return {
    audience:
      typeof formData.get("audience") === "string"
        ? (formData.get("audience") as ShiftMessageAudience)
        : undefined,
    audienceLabel:
      typeof formData.get("audienceLabel") === "string"
        ? (formData.get("audienceLabel") as string)
        : undefined,
    recipientIds: formData
      .getAll("recipientIds")
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
    body: typeof formData.get("body") === "string" ? (formData.get("body") as string) : undefined,
    shiftId:
      typeof formData.get("shiftId") === "string"
        ? (formData.get("shiftId") as string)
        : undefined,
    groupId:
      typeof formData.get("groupId") === "string"
        ? (formData.get("groupId") as string)
        : undefined,
    allowReplies: parseBooleanFormValue(formData.get("allowReplies")),
    attachments: formData
      .getAll("attachment")
      .filter((entry): entry is File => entry instanceof File)
      .filter((entry) => entry.size > 0),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { gigId } = await context.params;
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

  const state = await getStoredShiftCommunication(gigId);

  return NextResponse.json({ ok: true, state });
}

export async function POST(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
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

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const requestTypeEntry = formData.get("type");
    const requestType = typeof requestTypeEntry === "string" ? requestTypeEntry : "";

    if (requestType !== "message") {
      return NextResponse.json({ error: "Unsupported message upload type." }, { status: 400 });
    }

    const payload = parseMessagePayloadFromFormData(formData);

    if (!payload.audience || !validAudiences.has(payload.audience)) {
      return NextResponse.json({ error: "Choose a message audience." }, { status: 400 });
    }

    const audienceLabel = payload.audienceLabel?.trim();
    const body = payload.body?.trim() ?? "";

    if (!audienceLabel) {
      return NextResponse.json({ error: "Missing audience label." }, { status: 400 });
    }

    if (payload.recipientIds.length === 0) {
      return NextResponse.json({ error: "Choose at least one recipient." }, { status: 400 });
    }

    const invalidUpload = payload.attachments.find(
      (attachment) => !isAllowedShiftMessageAttachment(attachment),
    );

    if (invalidUpload) {
      return NextResponse.json(
        {
          error:
            "Only PDF, common office files, and image attachments are supported for shift communication.",
        },
        { status: 400 },
      );
    }

    if (!body && payload.attachments.length === 0) {
      return NextResponse.json(
        { error: "Write a message or add at least one attachment first." },
        { status: 400 },
      );
    }

    try {
      const attachments = await storeShiftMessageAttachments(gigId, payload.attachments);
      const state = await createStoredShiftMessage(gigId, {
        audience: payload.audience,
        audienceLabel,
        recipientIds: payload.recipientIds,
        body,
        shiftId: payload.shiftId?.trim() || undefined,
        groupId: payload.groupId?.trim() || undefined,
        authorType: "scm",
        allowReplies:
          typeof payload.allowReplies === "boolean"
            ? payload.allowReplies
            : payload.audience !== "bookedOnShift",
        attachments,
        authorName: currentProfile.displayName,
        authorProfileId: currentProfile.id,
      });

      return NextResponse.json({ ok: true, state });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not store the message attachments.",
        },
        { status: 500 },
      );
    }
  }

  const payload = (await request.json().catch(() => null)) as ShiftCommunicationJsonPayload | null;

  if (!payload) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  if (payload.type === "group") {
    const name = payload.name?.trim();
    const memberIds = payload.memberIds?.filter(Boolean) ?? [];

    if (!name) {
      return NextResponse.json({ error: "Add a group name." }, { status: 400 });
    }

    if (memberIds.length === 0) {
      return NextResponse.json({ error: "Choose at least one staff member." }, { status: 400 });
    }

    const state = await createStoredShiftMessageGroup(gigId, {
      name,
      memberIds,
    });

    return NextResponse.json({ ok: true, state });
  }

  if (!payload.audience || !validAudiences.has(payload.audience)) {
    return NextResponse.json({ error: "Choose a message audience." }, { status: 400 });
  }

  const body = payload.body?.trim() ?? "";
  const recipientIds = payload.recipientIds?.filter(Boolean) ?? [];
  const audienceLabel = payload.audienceLabel?.trim();

  if (!audienceLabel) {
    return NextResponse.json({ error: "Missing audience label." }, { status: 400 });
  }

  if (!body) {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }

  if (recipientIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one recipient." }, { status: 400 });
  }

  const state = await createStoredShiftMessage(gigId, {
    audience: payload.audience,
    audienceLabel,
    recipientIds,
    body,
    shiftId: payload.shiftId,
    groupId: payload.groupId,
    authorType: "scm",
    allowReplies:
      typeof payload.allowReplies === "boolean"
        ? payload.allowReplies
        : payload.audience !== "bookedOnShift",
    authorName: currentProfile.displayName,
    authorProfileId: currentProfile.id,
  });

  return NextResponse.json({ ok: true, state });
}
