"use server";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getCanonicalGigDocumentBoxTitle,
  isEndOfDayReportReceiptsGigDocumentBox,
  isEventManagerGigDocumentBox,
  isGigDocumentSection,
} from "@/lib/gig-document-boxes";
import {
  addStoredGigFiles,
  getStoredGigById,
} from "@/lib/gig-store";
import {
  buildGigAttachmentFileUrl,
  buildGigAttachmentStoragePath,
  createGigStoredFileName,
  getGigPublicFilesRootDirectory,
  resolveGigAttachmentAbsolutePath,
} from "@/lib/gig-file-storage";
import { appendReplyToShiftCommunicationThread } from "@/lib/shift-communication-replies";
import {
  createStoredShiftMessage,
  createStoredShiftMessageGroup,
} from "@/lib/shift-communication-store";
import { updateStoredShiftAssignment } from "@/lib/shift-store";
import { getStaffAppScmGigWorkspace } from "@/lib/staff-app-scm-ops";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";
import type { GigFileItem } from "@/types/scm";

const allowedExtensions = new Set(["pdf", "msg", "xlsx", "docx"]);
const endOfDayImageExtensions = new Set([
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

function getReturnToPath(formData: FormData, fallbackPath: string) {
  const returnTo = formData.get("returnTo");
  return typeof returnTo === "string" && returnTo.trim() ? returnTo : fallbackPath;
}

function normalizeTimestampValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsed = new Date(trimmedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeUniqueStringValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

async function requireAccessibleGig(gigId: string) {
  const profile = await requireCurrentStaffAppScmProfile();
  const workspace = await getStaffAppScmGigWorkspace(profile, gigId);

  if (!workspace) {
    redirect("/staff-app/scm/gigs");
  }

  return workspace;
}

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

export async function updateScmGigRosterEntryAction(formData: FormData) {
  const gigId = String(formData.get("gigId") ?? "").trim();
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const staffId = String(formData.get("staffId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "").trim();
  const returnTo = getReturnToPath(formData, `/staff-app/scm/live/${gigId}`);

  if (!gigId || !shiftId || !staffId || !intent) {
    redirect(returnTo);
  }

  await requireAccessibleGig(gigId);

  if (intent === "checkInNow") {
    await updateStoredShiftAssignment(gigId, shiftId, staffId, {
      checkedIn: new Date().toISOString(),
    });
    redirect(returnTo);
  }

  if (intent === "checkOutNow") {
    await updateStoredShiftAssignment(gigId, shiftId, staffId, {
      checkedOut: new Date().toISOString(),
    });
    redirect(returnTo);
  }

  if (intent === "clearTimes") {
    await updateStoredShiftAssignment(gigId, shiftId, staffId, {
      checkedIn: null,
      checkedOut: null,
      timeReportApproved: false,
    });
    redirect(returnTo);
  }

  if (intent === "removeAssignment") {
    await updateStoredShiftAssignment(gigId, shiftId, staffId, {
      bookingStatus: null,
    });
    redirect(returnTo);
  }

  if (intent === "saveTimes") {
    await updateStoredShiftAssignment(gigId, shiftId, staffId, {
      checkedIn: normalizeTimestampValue(formData.get("checkedIn")),
      checkedOut: normalizeTimestampValue(formData.get("checkedOut")),
      timeReportApproved: false,
    });
  }

  redirect(returnTo);
}

export async function assignScmGigStaffAction(formData: FormData) {
  const gigId = String(formData.get("gigId") ?? "").trim();
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const staffId = String(formData.get("staffId") ?? "").trim();
  const bookingStatus = String(formData.get("bookingStatus") ?? "Confirmed").trim();
  const returnTo = getReturnToPath(
    formData,
    `/staff-app/scm/live/${gigId}/shifts/${shiftId}`,
  );

  if (!gigId || !shiftId || !staffId) {
    redirect(returnTo);
  }

  await requireAccessibleGig(gigId);

  if (
    bookingStatus !== "Confirmed" &&
    bookingStatus !== "Pending" &&
    bookingStatus !== "Waitlisted"
  ) {
    redirect(returnTo);
  }

  const normalizedBookingStatus = bookingStatus as "Confirmed" | "Pending" | "Waitlisted";

  try {
    await updateStoredShiftAssignment(gigId, shiftId, staffId, {
      bookingStatus: normalizedBookingStatus,
    });
  } catch {
    redirect(returnTo);
  }

  redirect(returnTo);
}

export async function sendScmGigMessageAction(formData: FormData) {
  const gigId = String(formData.get("gigId") ?? "").trim();
  const messageMode = String(formData.get("messageMode") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const returnTo = getReturnToPath(formData, `/staff-app/scm/live/${gigId}`);

  if (!gigId || !body || !messageMode) {
    redirect(returnTo);
  }

  const profile = await requireCurrentStaffAppScmProfile();
  const workspace = await requireAccessibleGig(gigId);
  const confirmedRosterEntries = workspace.roster.filter(
    (entry) => entry.bookingStatus === "Confirmed",
  );
  let audienceLabel = "";
  let recipientIds: string[] = [];
  let audience: "bookedOnShift" | "standLeaders" | "individualPeople" | "customGroup";
  let groupId: string | undefined;
  let allowReplies = true;

  if (messageMode === "allBooked") {
    audience = "bookedOnShift";
    audienceLabel = "All booked staff";
    allowReplies = false;
    recipientIds = normalizeUniqueStringValues(
      confirmedRosterEntries.map((entry) => entry.staffId),
    );
  } else if (messageMode === "standLeaders") {
    audience = "standLeaders";
    audienceLabel = "Stand leaders";
    recipientIds = normalizeUniqueStringValues(
      confirmedRosterEntries
        .filter(
          (entry) => entry.shiftRole.trim().toLowerCase() === "stand leader",
        )
        .map((entry) => entry.staffId),
    );
  } else if (messageMode === "direct") {
    const recipientId = String(formData.get("recipientId") ?? "").trim();
    const recipient = workspace.roster.find((entry) => entry.staffId === recipientId);

    audience = "individualPeople";
    audienceLabel = recipient?.staffName ?? "Direct chat";
    recipientIds = recipientId ? [recipientId] : [];
  } else if (messageMode === "group") {
    const groupName = String(formData.get("groupName") ?? "").trim();
    const memberIds = normalizeUniqueStringValues(
      formData
        .getAll("memberIds")
        .filter((entry): entry is string => typeof entry === "string"),
    );

    if (!groupName || memberIds.length === 0) {
      redirect(returnTo);
    }

    const nextState = await createStoredShiftMessageGroup(gigId, {
      name: groupName,
      memberIds,
    });
    const createdGroup = nextState.customGroups[0];

    if (!createdGroup) {
      redirect(returnTo);
    }

    audience = "customGroup";
    audienceLabel = createdGroup.name;
    recipientIds = createdGroup.memberIds;
    groupId = createdGroup.id;
  } else {
    redirect(returnTo);
  }

  if (recipientIds.length === 0) {
    redirect(returnTo);
  }

  await createStoredShiftMessage(gigId, {
    audience,
    audienceLabel,
    recipientIds,
    body,
    groupId,
    authorName: `${profile.firstName} ${profile.lastName}`,
    authorProfileId: profile.id,
    authorType: "scm",
    allowReplies,
  });

  revalidatePath(`/staff-app/scm/live/${gigId}`);
  redirect(returnTo);
}

export async function sendScmGigConversationReplyAction(formData: FormData) {
  const gigId = String(formData.get("gigId") ?? "").trim();
  const threadId = String(formData.get("threadId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const returnTo = getReturnToPath(
    formData,
    `/staff-app/scm/live/${gigId}/messages/${threadId}`,
  );
  const attachments = formData
    .getAll("attachment")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!gigId || !threadId) {
    redirect(returnTo);
  }

  const profile = await requireCurrentStaffAppScmProfile();
  const workspace = await requireAccessibleGig(gigId);

  if (!workspace) {
    redirect("/staff-app/scm/gigs");
  }

  try {
    await appendReplyToShiftCommunicationThread({
      gigId,
      threadId,
      body,
      attachments,
      authorName: `${profile.firstName} ${profile.lastName}`,
      authorProfileId: profile.id,
      authorType: "scm",
    });
  } catch {
    redirect(returnTo);
  }

  revalidatePath(`/staff-app/scm/live/${gigId}`);
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function uploadScmGigFileAction(formData: FormData) {
  const gigId = String(formData.get("gigId") ?? "").trim();
  const returnTo = getReturnToPath(formData, `/staff-app/scm/live/${gigId}`);

  if (!gigId) {
    redirect(returnTo);
  }

  const workspace = await requireAccessibleGig(gigId);
  const gig = (await getStoredGigById(gigId)) ?? workspace.gig;
  const uploadedEntries = formData
    .getAll("file")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const sectionEntry = formData.get("section");
  const folderNameEntry = formData.get("folderName");
  const requestedSection = typeof sectionEntry === "string" ? sectionEntry : "";

  if (!isGigDocumentSection(requestedSection) || uploadedEntries.length === 0) {
    redirect(returnTo);
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

  const invalidUpload = uploadedEntries.find(
    (uploadedFile) =>
      !isAllowedGigUploadFileType(
        uploadedFile,
        isEventManagerAttachmentUpload,
        isEndOfDayReportUpload,
      ),
  );

  if (invalidUpload) {
    redirect(returnTo);
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
        redirect(returnTo);
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

  await addStoredGigFiles(gigId, storedFiles);
  redirect(returnTo);
}
