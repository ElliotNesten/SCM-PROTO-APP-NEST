import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { ShiftMessageAttachment } from "@/types/scm";
import {
  buildShiftMessageAttachmentFileUrl,
  buildShiftMessageAttachmentStoragePath,
  resolveShiftMessageAttachmentAbsolutePath,
} from "@/lib/shift-communication-attachment-storage";

const allowedDocumentExtensions = new Set([
  "pdf",
  "msg",
  "xlsx",
  "xls",
  "docx",
  "doc",
  "csv",
  "txt",
]);

const imageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "heic",
  "heif",
]);

const mimeTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  msg: "application/vnd.ms-outlook",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

export function isAllowedShiftMessageAttachment(uploadedFile: File) {
  const fileExtension = path.extname(uploadedFile.name).toLowerCase().replace(".", "");
  const normalizedMimeType = uploadedFile.type.trim().toLowerCase();

  return (
    normalizedMimeType.startsWith("image/") ||
    imageExtensions.has(fileExtension) ||
    allowedDocumentExtensions.has(fileExtension) ||
    normalizedMimeType === "application/pdf" ||
    normalizedMimeType === "application/vnd.ms-outlook" ||
    normalizedMimeType === "application/vnd.ms-excel" ||
    normalizedMimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    normalizedMimeType === "application/msword" ||
    normalizedMimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedMimeType === "text/csv" ||
    normalizedMimeType === "text/plain"
  );
}

export async function storeShiftMessageAttachments(
  gigId: string,
  uploadedEntries: File[],
): Promise<ShiftMessageAttachment[]> {
  const storedAttachments: ShiftMessageAttachment[] = [];

  for (const uploadedEntry of uploadedEntries) {
    const uniqueSuffix = randomUUID().slice(0, 8);
    const attachmentId = `shift-attachment-${uniqueSuffix}`;
    const normalizedExtension = path
      .extname(uploadedEntry.name)
      .toLowerCase()
      .replace(".", "")
      .trim();
    const storagePath = buildShiftMessageAttachmentStoragePath(
      gigId,
      uploadedEntry.name,
      uniqueSuffix,
    );
    const absoluteAttachmentPath = resolveShiftMessageAttachmentAbsolutePath(storagePath);

    if (!absoluteAttachmentPath) {
      throw new Error("Could not prepare message attachment storage.");
    }

    const fileBuffer = Buffer.from(await uploadedEntry.arrayBuffer());

    await fs.mkdir(path.dirname(absoluteAttachmentPath), { recursive: true });
    await fs.writeFile(absoluteAttachmentPath, fileBuffer);

    storedAttachments.push({
      id: attachmentId,
      fileName: uploadedEntry.name,
      fileSize: uploadedEntry.size,
      uploadedAt: new Date().toISOString(),
      mimeType:
        uploadedEntry.type ||
        mimeTypesByExtension[normalizedExtension] ||
        "application/octet-stream",
      extension: normalizedExtension,
      url: buildShiftMessageAttachmentFileUrl(gigId, attachmentId),
      storagePath,
    });
  }

  return storedAttachments;
}
