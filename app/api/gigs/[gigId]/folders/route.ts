import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import {
  getCanonicalGigDocumentBoxTitle,
  isDefaultGigDocumentBoxTitle,
  isGigDocumentSection,
} from "@/lib/gig-document-boxes";
import {
  createStoredGigFolder,
  getStoredGigById,
  removeStoredGigFolder,
} from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

const uploadRootDirectory = path.join(process.cwd(), "public", "gig-files");

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

  const payload = (await request.json().catch(() => null)) as
    | { name?: string; section?: string }
    | null;
  const requestedSection = payload?.section ?? "";

  if (!isGigDocumentSection(requestedSection)) {
    return NextResponse.json({ error: "Choose a valid document section first." }, { status: 400 });
  }

  const section = requestedSection;

  const folderName = getCanonicalGigDocumentBoxTitle(section, payload?.name ?? "", {
    gigArtist: gig.artist,
  });

  if (!folderName) {
    return NextResponse.json({ error: "Enter a box title first." }, { status: 400 });
  }

  if (isDefaultGigDocumentBoxTitle(section, folderName, { gigArtist: gig.artist })) {
    return NextResponse.json(
      { error: "This default box already exists." },
      { status: 400 },
    );
  }

  const result = await createStoredGigFolder(gigId, folderName, section);

  if (!result) {
    return NextResponse.json(
      { error: "Gig not found or box title is invalid." },
      { status: 404 },
    );
  }

  await fs.mkdir(path.join(uploadRootDirectory, gigId, result.folder.slug), { recursive: true });

  return NextResponse.json({
    ok: true,
    folder: result.folder,
    folders: result.gig.fileFolders ?? [],
    alreadyExists: result.alreadyExists,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
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

  const payload = (await request.json().catch(() => null)) as { folderId?: string } | null;
  const folderId = payload?.folderId?.trim() ?? "";

  if (!folderId) {
    return NextResponse.json({ error: "Choose a box to delete." }, { status: 400 });
  }

  const result = await removeStoredGigFolder(gigId, folderId);

  if (!result) {
    return NextResponse.json({ error: "The box could not be found." }, { status: 404 });
  }

  if (result.hasFiles) {
    return NextResponse.json(
      { error: "Only empty custom boxes can be deleted." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    deletedFolderId: folderId,
    folders: result.gig.fileFolders ?? [],
  });
}
