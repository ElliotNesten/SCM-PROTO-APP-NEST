import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import {
  getCanonicalGigDocumentBoxTitle,
  isEndOfDayReportReceiptsGigDocumentBox,
  isEventManagerGigDocumentBox,
  isGigDocumentSection,
} from "@/lib/gig-document-boxes";
import {
  buildGigAttachmentFileUrl,
  buildGigAttachmentStoragePath,
  createGigStoredFileName,
  getGigPublicFilesRootDirectory,
  resolveGigAttachmentAbsolutePath,
  resolveGigPublicFileAbsolutePath,
} from "@/lib/gig-file-storage";
import { addStoredGigFiles, getStoredGigById, removeStoredGigFile } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import type { GigFileItem } from "@/types/scm";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

const allowedExtensions = new Set(["pdf", "msg", "xlsx", "docx"]);
const endOfDayImageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif", "heic", "heif"]);

const mimeTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  msg: "application/vnd.ms-outlook",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  eml: "message/rfc822",
  em2: "application/octet-stream",
};

function isAllowedGigUploadFileType(
  uploadedFile: File,
  isEventManagerAttachmentUpload: boolean,
  isEndOfDayReportUpload: boolean,
) {
  const fileExtension = path.extname(uploadedFile.name).toLowerCase().replace(".", "");
  const isImageUpload =
    uploadedFile.type.toLowerCase().startsWith("image/") ||
    endOfDayImageExtensions.has(fileExtension);

  return (
    isEventManagerAttachmentUpload ||
    (isEndOfDayReportUpload && isImageUpload) ||
    allowedExtensions.has(fileExtension) ||
    uploadedFile.type === "application/pdf" ||
    uploadedFile.type === "application/vnd.ms-outlook" ||
    uploadedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    uploadedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
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

  const formData = await request.formData();
  const uploadedEntries = formData.getAll("file").filter((entry): entry is File => entry instanceof File);
  const folderNameEntry = formData.get("folderName");
  const sectionEntry = formData.get("section");
  const requestedSection = typeof sectionEntry === "string" ? sectionEntry : "";

  if (!isGigDocumentSection(requestedSection)) {
    return NextResponse.json({ error: "Choose a valid document section first." }, { status: 400 });
  }

  const section = requestedSection;

  const folderName =
    typeof folderNameEntry === "string"
      ? getCanonicalGigDocumentBoxTitle(section, folderNameEntry, { gigArtist: gig.artist })
      : "";
  const isEventManagerAttachmentUpload = isEventManagerGigDocumentBox(section, folderName, {
    gigArtist: gig.artist,
  });
  const isEndOfDayReportUpload = isEndOfDayReportReceiptsGigDocumentBox(section, folderName, {
    gigArtist: gig.artist,
  });

  if (uploadedEntries.length === 0) {
    return NextResponse.json(
      { error: "Choose one or more files to upload first." },
      { status: 400 },
    );
  }

  const invalidUpload = uploadedEntries.find(
    (uploadedFile) =>
      !isAllowedGigUploadFileType(
        uploadedFile,
        isEventManagerAttachmentUpload,
        isEndOfDayReportUpload,
      ),
  );

  if (invalidUpload) {
    return NextResponse.json(
      {
        error:
          "Only PDF, MSG, XLSX, and DOCX files are supported here. End-of-Day Report & Receipts also accepts image files. Use Event Manager for original attachments.",
      },
      { status: 400 },
    );
  }

  const storedFiles: GigFileItem[] = [];

  for (const uploadedEntry of uploadedEntries) {
    const uniqueSuffix = randomUUID().slice(0, 8);
    const fileExtension = path.extname(uploadedEntry.name).toLowerCase().replace(".", "");
    const normalizedExtension = fileExtension.trim().toLowerCase();
    const fileBuffer = Buffer.from(await uploadedEntry.arrayBuffer());

    let fileUrl = "";
    let storageMode: GigFileItem["storageMode"] = "public";
    let storagePath: string | undefined;

    if (isEventManagerAttachmentUpload) {
      const nextStoragePath = buildGigAttachmentStoragePath(
        gigId,
        uploadedEntry.name,
        uniqueSuffix,
      );
      const absoluteAttachmentPath = resolveGigAttachmentAbsolutePath(nextStoragePath);

      if (!absoluteAttachmentPath) {
        return NextResponse.json({ error: "Could not prepare attachment storage." }, { status: 500 });
      }

      await fs.mkdir(path.dirname(absoluteAttachmentPath), { recursive: true });
      await fs.writeFile(absoluteAttachmentPath, fileBuffer);

      fileUrl = buildGigAttachmentFileUrl(gigId, `file-${uniqueSuffix}`);
      storageMode = "attachment";
      storagePath = nextStoragePath;
    } else {
      const storageFileName = createGigStoredFileName(uploadedEntry.name, uniqueSuffix);
      const gigDirectory = path.join(getGigPublicFilesRootDirectory(), gigId);
      const outputPath = path.join(gigDirectory, storageFileName);

      await fs.mkdir(gigDirectory, { recursive: true });
      await fs.writeFile(outputPath, fileBuffer);

      fileUrl = `/gig-files/${gigId}/${storageFileName}`;
    }

    storedFiles.push({
      id: `file-${uniqueSuffix}`,
      fileName: uploadedEntry.name,
      fileSize: uploadedEntry.size,
      uploadedAt: new Date().toISOString(),
      mimeType:
        uploadedEntry.type ||
        mimeTypesByExtension[normalizedExtension] ||
        "application/octet-stream",
      extension: normalizedExtension,
      url: fileUrl,
      storageMode,
      storagePath,
      section,
      folderName: folderName || undefined,
    });
  }

  const updatedGig = await addStoredGigFiles(gigId, storedFiles);

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    file: storedFiles[0],
    uploadedFiles: storedFiles,
    files: updatedGig.files ?? [],
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

  const payload = (await request.json().catch(() => null)) as { fileId?: string } | null;
  const fileId = payload?.fileId?.trim() ?? "";

  if (!fileId) {
    return NextResponse.json({ error: "Choose a file to delete." }, { status: 400 });
  }

  const result = await removeStoredGigFile(gigId, fileId);

  if (!result) {
    return NextResponse.json({ error: "The file could not be found." }, { status: 404 });
  }

  const filePath =
    result.removedFile.storageMode === "attachment" && result.removedFile.storagePath
      ? resolveGigAttachmentAbsolutePath(result.removedFile.storagePath)
      : resolveGigPublicFileAbsolutePath(result.removedFile.url);

  if (filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      const unlinkError = error as NodeJS.ErrnoException;

      if (unlinkError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    deletedFileId: fileId,
    files: result.gig.files ?? [],
  });
}
