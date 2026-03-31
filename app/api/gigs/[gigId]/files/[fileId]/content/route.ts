import { promises as fs } from "fs";

import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import {
  isGigFilePreviewablePdf,
  isGigFileStoredAsAttachment,
  resolveGigAttachmentAbsolutePath,
} from "@/lib/gig-file-storage";
import { getStoredGigById } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string; fileId: string }>;
};

function encodeContentDispositionFilename(fileName: string) {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "");
  const encodedFileName = encodeURIComponent(fileName)
    .replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");

  return `filename="${asciiFallback || "attachment"}"; filename*=UTF-8''${encodedFileName}`;
}

export async function GET(request: Request, context: RouteContext) {
  const { gigId, fileId } = await context.params;
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

  const file = (gig.files ?? []).find((entry) => entry.id === fileId);

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  if (!isGigFileStoredAsAttachment(file)) {
    return NextResponse.redirect(new URL(file.url, request.url));
  }

  const absolutePath = resolveGigAttachmentAbsolutePath(file.storagePath);

  if (!absolutePath) {
    return NextResponse.json({ error: "Stored file path is invalid." }, { status: 500 });
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

  const dispositionType = isGigFilePreviewablePdf(file) ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `${dispositionType}; ${encodeContentDispositionFilename(file.fileName)}`,
      "Content-Length": String(fileBuffer.byteLength),
      "Content-Type": file.mimeType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
