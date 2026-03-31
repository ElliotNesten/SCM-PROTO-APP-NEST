import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import {
  isShiftMessageAttachmentImage,
  isShiftMessageAttachmentPreviewablePdf,
  resolveShiftMessageAttachmentAbsolutePath,
} from "@/lib/shift-communication-attachment-storage";
import { getStoredGigById } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import { getStoredShiftMessageAttachmentById } from "@/lib/shift-communication-store";
import {
  getCurrentStaffAppAccount,
  getCurrentStaffAppScmProfile,
} from "@/lib/staff-app-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string; attachmentId: string }>;
};

function encodeContentDispositionFilename(fileName: string) {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "");
  const encodedFileName = encodeURIComponent(fileName)
    .replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");

  return `filename="${asciiFallback || "attachment"}"; filename*=UTF-8''${encodedFileName}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { gigId, attachmentId } = await context.params;
  const gig = await getStoredGigById(gigId);

  if (!gig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  const attachmentRecord = await getStoredShiftMessageAttachmentById(gigId, attachmentId);

  if (!attachmentRecord) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const [platformProfile, staffAppAccount, staffAppScmProfile] = await Promise.all([
    getCurrentAuthenticatedScmStaffProfile(),
    getCurrentStaffAppAccount(),
    getCurrentStaffAppScmProfile(),
  ]);

  const hasPlatformAccess = Boolean(
    (platformProfile && canAccessPlatformGig(platformProfile, gig)) ||
      (staffAppScmProfile && canAccessPlatformGig(staffAppScmProfile, gig)),
  );

  const linkedStaffId = staffAppAccount?.linkedStaffProfileId?.trim() ?? "";
  const isRecipient =
    linkedStaffId.length > 0 &&
    attachmentRecord.message.recipientIds.includes(linkedStaffId);

  if (!hasPlatformAccess && !isRecipient) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const absolutePath = resolveShiftMessageAttachmentAbsolutePath(
    attachmentRecord.attachment.storagePath,
  );

  if (!absolutePath) {
    return NextResponse.json({ error: "Stored attachment path is invalid." }, { status: 500 });
  }

  let fileBuffer: Buffer;

  try {
    fileBuffer = await fs.readFile(absolutePath);
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === "ENOENT") {
      return NextResponse.json({ error: "Stored attachment not found." }, { status: 404 });
    }

    throw error;
  }

  const dispositionType =
    isShiftMessageAttachmentImage(attachmentRecord.attachment) ||
    isShiftMessageAttachmentPreviewablePdf(attachmentRecord.attachment)
      ? "inline"
      : "attachment";

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `${dispositionType}; ${encodeContentDispositionFilename(
        attachmentRecord.attachment.fileName,
      )}`,
      "Content-Length": String(fileBuffer.byteLength),
      "Content-Type":
        attachmentRecord.attachment.mimeType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
