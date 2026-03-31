import path from "path";

import type { GigFileItem } from "@/types/scm";

const publicRootDirectory = path.join(process.cwd(), "public");
const publicGigFilesRootDirectory = path.join(publicRootDirectory, "gig-files");
const attachmentRootDirectory = path.join(process.cwd(), "data", "gig-file-attachments");

export function getGigPublicFilesRootDirectory() {
  return publicGigFilesRootDirectory;
}

export function getGigPublicRootDirectory() {
  return publicRootDirectory;
}

export function getGigAttachmentRootDirectory() {
  return attachmentRootDirectory;
}

export function sanitizeGigStoredFileBaseName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function createGigStoredFileName(fileName: string, uniqueSuffix: string) {
  const baseName = sanitizeGigStoredFileBaseName(path.parse(fileName).name) || "gig-file";
  const normalizedExtension = path.extname(fileName).replace(".", "").trim().toLowerCase();

  if (!normalizedExtension) {
    return `${baseName}-${uniqueSuffix}`;
  }

  return `${baseName}-${uniqueSuffix}.${normalizedExtension}`;
}

export function buildGigAttachmentStoragePath(
  gigId: string,
  fileName: string,
  uniqueSuffix: string,
) {
  return path.join(gigId, createGigStoredFileName(fileName, uniqueSuffix));
}

export function resolveGigAttachmentAbsolutePath(storagePath: string) {
  const normalizedRoot = path.normalize(attachmentRootDirectory);
  const absolutePath = path.normalize(path.join(attachmentRootDirectory, storagePath));

  if (!absolutePath.startsWith(normalizedRoot)) {
    return null;
  }

  return absolutePath;
}

export function resolveGigPublicFileAbsolutePath(fileUrl: string) {
  const relativeSegments = fileUrl.split("/").filter(Boolean);
  const absolutePath = path.normalize(path.join(publicRootDirectory, ...relativeSegments));
  const normalizedRoot = path.normalize(publicRootDirectory);

  if (!absolutePath.startsWith(normalizedRoot)) {
    return null;
  }

  return absolutePath;
}

export function buildGigAttachmentFileUrl(gigId: string, fileId: string) {
  return `/api/gigs/${gigId}/files/${fileId}/content`;
}

export function isGigFileStoredAsAttachment<
  T extends Pick<GigFileItem, "storageMode" | "storagePath">,
>(
  file: T,
): file is T & { storageMode: "attachment"; storagePath: string } {
  return file.storageMode === "attachment" && Boolean(file.storagePath?.trim());
}

export function isGigFilePreviewablePdf(
  file: Pick<GigFileItem, "extension" | "mimeType" | "fileName">,
) {
  const normalizedExtension = file.extension?.trim().toLowerCase();

  if (normalizedExtension === "pdf") {
    return true;
  }

  if (file.mimeType?.trim().toLowerCase() === "application/pdf") {
    return true;
  }

  return path.extname(file.fileName).trim().toLowerCase() === ".pdf";
}
