import path from "path";

import { createGigStoredFileName } from "@/lib/gig-file-storage";
import type { ShiftMessageAttachment } from "@/types/scm";

const attachmentRootDirectory = path.join(
  process.cwd(),
  "data",
  "shift-communication-attachments",
);

const imageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "heic",
  "heif",
]);

export function getShiftCommunicationAttachmentRootDirectory() {
  return attachmentRootDirectory;
}

export function buildShiftMessageAttachmentStoragePath(
  gigId: string,
  fileName: string,
  uniqueSuffix: string,
) {
  return path.join(gigId, createGigStoredFileName(fileName, uniqueSuffix));
}

export function resolveShiftMessageAttachmentAbsolutePath(storagePath: string) {
  const normalizedRoot = path.normalize(attachmentRootDirectory);
  const absolutePath = path.normalize(path.join(attachmentRootDirectory, storagePath));

  if (!absolutePath.startsWith(normalizedRoot)) {
    return null;
  }

  return absolutePath;
}

export function buildShiftMessageAttachmentFileUrl(
  gigId: string,
  attachmentId: string,
) {
  return `/api/gigs/${gigId}/shift-communications/attachments/${attachmentId}/content`;
}

export function isShiftMessageAttachmentImage(
  attachment: Pick<ShiftMessageAttachment, "mimeType" | "extension" | "fileName">,
) {
  const normalizedMimeType = attachment.mimeType.trim().toLowerCase();
  const normalizedExtension = attachment.extension.trim().toLowerCase();

  return (
    normalizedMimeType.startsWith("image/") ||
    imageExtensions.has(normalizedExtension) ||
    path.extname(attachment.fileName).trim().toLowerCase() === ".png" ||
    path.extname(attachment.fileName).trim().toLowerCase() === ".jpg" ||
    path.extname(attachment.fileName).trim().toLowerCase() === ".jpeg" ||
    path.extname(attachment.fileName).trim().toLowerCase() === ".webp" ||
    path.extname(attachment.fileName).trim().toLowerCase() === ".gif" ||
    path.extname(attachment.fileName).trim().toLowerCase() === ".heic" ||
    path.extname(attachment.fileName).trim().toLowerCase() === ".heif"
  );
}

export function isShiftMessageAttachmentPreviewablePdf(
  attachment: Pick<ShiftMessageAttachment, "mimeType" | "extension" | "fileName">,
) {
  const normalizedMimeType = attachment.mimeType.trim().toLowerCase();
  const normalizedExtension = attachment.extension.trim().toLowerCase();

  return (
    normalizedExtension === "pdf" ||
    normalizedMimeType === "application/pdf" ||
    path.extname(attachment.fileName).trim().toLowerCase() === ".pdf"
  );
}
