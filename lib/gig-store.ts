import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { gigs as seedGigs, resolveGigOverviewIndicator } from "@/data/scm-data";
import {
  getCanonicalGigDocumentBoxTitle,
  inferGigDocumentSectionFromFolderName,
  inferLegacyGigFileBoxTitle,
  isGigDocumentSection,
  normalizeGigDocumentBoxName,
} from "@/lib/gig-document-boxes";
import type {
  GigCommentField,
  GigDocumentSection,
  Gig,
  GigEquipmentItem,
  GigFileFolder,
  GigFileItem,
  GigFileStorageMode,
  GigOverviewIndicator,
  GigStatus,
  GigTemporaryManagerAssignment,
} from "@/types/scm";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "gig-store.json");

function shouldIgnoreReadOnlyStoreWriteError(error: unknown) {
  const errorCode =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";

  return (
    errorCode === "EACCES" ||
    errorCode === "EPERM" ||
    errorCode === "EROFS" ||
    errorCode === "ENOENT"
  );
}

type NewGigInput = {
  artist: string;
  arena: string;
  city: string;
  country: string;
  date: string;
  startTime: string;
  endTime: string;
  promoter: string;
  merchCompany: string;
  merchRepresentative: string;
  scmRepresentative: string;
  projectManager?: string;
  ticketsSold: number;
  estimatedSpendPerVisitor: number;
  arenaNotes: string;
  securitySetup: string;
  generalComments: string;
  equipment: GigEquipmentItem[];
  status: GigStatus;
};

type UpdateGigOverviewInput = {
  artist: string;
  arena: string;
  city: string;
  country: string;
  date: string;
  startTime: string;
  endTime: string;
  promoter: string;
  merchCompany: string;
  merchRepresentative: string;
  scmRepresentative: string;
  projectManager: string;
  notes: string;
  ticketsSold: number;
  estimatedSpendPerVisitor: number;
  arenaNotes: string;
  securitySetup: string;
  generalComments: string;
  customNoteFields: GigCommentField[];
  overviewIndicator: GigOverviewIndicator;
};

export type GigTemporaryManagerTimeline = {
  platformAccessEndsOn: string;
  visibleUntil: string;
  isPlatformAccessible: boolean;
  isVisibleInStaffApp: boolean;
  shouldPurge: boolean;
};

function getTodayInStockholmDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseIsoDateKey(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function formatIsoDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDaysToIsoDate(value: string, days: number) {
  const parsed = parseIsoDateKey(value);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatIsoDateKey(parsed);
}

export function getGigTemporaryManagerTimeline(gigDate: string): GigTemporaryManagerTimeline {
  const today = getTodayInStockholmDate();
  const visibleUntil = addDaysToIsoDate(gigDate, 7);

  return {
    platformAccessEndsOn: gigDate,
    visibleUntil,
    isPlatformAccessible: today <= gigDate,
    isVisibleInStaffApp: today <= visibleUntil,
    shouldPurge: today > visibleUntil,
  };
}

function normalizeTemporaryGigManagers(
  gigDate: string,
  assignments: GigTemporaryManagerAssignment[] | undefined,
) {
  const timeline = getGigTemporaryManagerTimeline(gigDate);
  const sourceAssignments = Array.isArray(assignments) ? assignments : [];
  const seenStaffIds = new Set<string>();
  let didChange = !Array.isArray(assignments);

  const normalizedAssignments = sourceAssignments.filter((assignment) => {
    const staffProfileId = assignment.staffProfileId?.trim() ?? "";
    const assignmentId = assignment.id?.trim() ?? "";

    if (!staffProfileId || !assignmentId || timeline.shouldPurge) {
      didChange = true;
      return false;
    }

    if (seenStaffIds.has(staffProfileId)) {
      didChange = true;
      return false;
    }

    seenStaffIds.add(staffProfileId);

    if (assignment.staffProfileId !== staffProfileId || assignment.id !== assignmentId) {
      didChange = true;
    }

    return true;
  });

  return {
    assignments: normalizedAssignments,
    didChange,
  };
}

function normalizeGigDocumentSectionValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  return isGigDocumentSection(value) ? value : null;
}

function normalizeGigFileStorageModeValue(
  value: GigFileStorageMode | string | undefined,
  storagePath: string | undefined,
) {
  if (value === "attachment" && storagePath?.trim()) {
    return "attachment" as const;
  }

  return "public" as const;
}

function normalizeOptionalTimestamp(value: string | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeOptionalBoolean(value: boolean | undefined) {
  return value === true ? true : undefined;
}

function normalizeOptionalText(value: string | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeOptionalGigStatus(value: GigStatus | string | undefined) {
  const validStatuses = new Set<GigStatus>([
    "Identified",
    "Planning",
    "Published",
    "Confirmed",
    "Investigating",
    "Completed",
    "Reported",
    "Closed",
  ]);

  return validStatuses.has(value as GigStatus) ? (value as GigStatus) : undefined;
}

function normalizeOptionalProgress(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const numericValue = value as number;
  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function resolveReopenedGigStatus(statusBeforeClose: GigStatus | undefined) {
  if (
    statusBeforeClose &&
    statusBeforeClose !== "Closed" &&
    statusBeforeClose !== "Completed" &&
    statusBeforeClose !== "Reported"
  ) {
    return statusBeforeClose;
  }

  return "Confirmed" as const;
}

function resolveReopenedGigProgress(
  statusBeforeClose: GigStatus | undefined,
  progressBeforeClose: number | undefined,
) {
  if (
    statusBeforeClose &&
    statusBeforeClose !== "Closed" &&
    statusBeforeClose !== "Completed" &&
    statusBeforeClose !== "Reported" &&
    Number.isFinite(progressBeforeClose)
  ) {
    return progressBeforeClose as number;
  }

  if (Number.isFinite(progressBeforeClose)) {
    return Math.min(progressBeforeClose as number, 95);
  }

  return 90;
}

function normalizeGigDocuments(gig: Gig) {
  const sourceFolders = Array.isArray(gig.fileFolders) ? gig.fileFolders : [];
  const sourceFiles = Array.isArray(gig.files) ? gig.files : [];
  const folderSectionByName = new Map<string, GigDocumentSection>();
  const documentBoxContext = { gigArtist: gig.artist };
  let didChange = !Array.isArray(gig.fileFolders) || !Array.isArray(gig.files);

  const normalizedFolders = sourceFolders.map((folder) => {
    const trimmedName = folder.name?.trim() ?? "";
    const resolvedSection =
      inferGigDocumentSectionFromFolderName(trimmedName, documentBoxContext) ??
      normalizeGigDocumentSectionValue(folder.section) ??
      "files";
    const canonicalTitle =
      getCanonicalGigDocumentBoxTitle(resolvedSection, trimmedName, documentBoxContext) ||
      trimmedName;
    const normalizedFolder = {
      ...folder,
      name: canonicalTitle,
      slug: sanitizeFolderSlug(canonicalTitle) || folder.slug,
      section: resolvedSection,
    } satisfies GigFileFolder;

    folderSectionByName.set(normalizeGigDocumentBoxName(canonicalTitle), resolvedSection);

    if (
      normalizedFolder.name !== folder.name ||
      normalizedFolder.slug !== folder.slug ||
      normalizedFolder.section !== folder.section
    ) {
      didChange = true;
    }

    return normalizedFolder;
  });

  const normalizedFiles = sourceFiles.map((file) => {
    const trimmedFolderName = file.folderName?.trim() ?? "";
    const sectionFromFolderName = trimmedFolderName
      ? inferGigDocumentSectionFromFolderName(trimmedFolderName, documentBoxContext)
      : null;
    const sectionFromCustomFolder = trimmedFolderName
      ? folderSectionByName.get(normalizeGigDocumentBoxName(trimmedFolderName)) ?? null
      : null;
    const resolvedSection =
      sectionFromFolderName ??
      normalizeGigDocumentSectionValue(file.section) ??
      sectionFromCustomFolder ??
      "files";

    const normalizedFolderName = trimmedFolderName
      ? getCanonicalGigDocumentBoxTitle(
          resolvedSection,
          trimmedFolderName,
          documentBoxContext,
        ) || trimmedFolderName
      : inferLegacyGigFileBoxTitle(file);
    const normalizedStoragePath = file.storagePath?.trim() || undefined;
    const normalizedStorageMode = normalizeGigFileStorageModeValue(
      file.storageMode,
      normalizedStoragePath,
    );

    const normalizedFile = {
      ...file,
      storageMode: normalizedStorageMode,
      storagePath: normalizedStorageMode === "attachment" ? normalizedStoragePath : undefined,
      section: resolvedSection,
      folderName: normalizedFolderName || undefined,
    } satisfies GigFileItem;

    if (
      normalizedFile.storageMode !== file.storageMode ||
      normalizedFile.storagePath !== file.storagePath ||
      normalizedFile.section !== file.section ||
      normalizedFile.folderName !== file.folderName
    ) {
      didChange = true;
    }

    return normalizedFile;
  });

  return {
    folders: normalizedFolders,
    files: normalizedFiles,
    didChange,
  };
}

function normalizeStoredGig(gig: Gig) {
  const { assignments, didChange: temporaryManagersChanged } = normalizeTemporaryGigManagers(
    gig.date,
    gig.temporaryGigManagers,
  );
  const { folders, files, didChange: documentsChanged } = normalizeGigDocuments(gig);
  const normalizedInvoicesPaidAt = normalizeOptionalTimestamp(gig.invoicesPaidAt);
  const normalizedEconomyComment = normalizeOptionalText(gig.economyComment);
  const normalizedTimeReportFinalApprovedAt = normalizeOptionalTimestamp(
    gig.timeReportFinalApprovedAt,
  );
  const normalizedClosedAt = normalizeOptionalTimestamp(gig.closedAt);
  const normalizedClosedByProfileId = normalizeOptionalText(gig.closedByProfileId);
  const normalizedClosedByName = normalizeOptionalText(gig.closedByName);
  const normalizedCloseOverrideUsed = normalizeOptionalBoolean(gig.closeOverrideUsed);
  const normalizedStatusBeforeClose = normalizeOptionalGigStatus(gig.statusBeforeClose);
  const normalizedProgressBeforeClose = normalizeOptionalProgress(gig.progressBeforeClose);

  return {
    gig: {
      ...gig,
      files,
      fileFolders: folders,
      temporaryGigManagers: assignments,
      invoicesPaidAt: normalizedInvoicesPaidAt,
      economyComment: normalizedEconomyComment,
      timeReportFinalApprovedAt: normalizedTimeReportFinalApprovedAt,
      closedAt: normalizedClosedAt,
      closedByProfileId: normalizedClosedByProfileId,
      closedByName: normalizedClosedByName,
      closeOverrideUsed: normalizedCloseOverrideUsed,
      statusBeforeClose: normalizedStatusBeforeClose,
      progressBeforeClose: normalizedProgressBeforeClose,
    },
    didChange:
      temporaryManagersChanged ||
      documentsChanged ||
      normalizedInvoicesPaidAt !== gig.invoicesPaidAt ||
      normalizedEconomyComment !== gig.economyComment ||
      normalizedTimeReportFinalApprovedAt !== gig.timeReportFinalApprovedAt ||
      normalizedClosedAt !== gig.closedAt ||
      normalizedClosedByProfileId !== gig.closedByProfileId ||
      normalizedClosedByName !== gig.closedByName ||
      normalizedCloseOverrideUsed !== gig.closeOverrideUsed ||
      normalizedStatusBeforeClose !== gig.statusBeforeClose ||
      normalizedProgressBeforeClose !== gig.progressBeforeClose,
  };
}

async function ensureGigStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(seedGigs, null, 2), "utf8");
  }
}

async function readGigStore(): Promise<Gig[]> {
  await ensureGigStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Gig[];
  const normalizedEntries = parsed.map(normalizeStoredGig);
  const normalizedGigs = normalizedEntries.map((entry) => entry.gig);

  if (normalizedEntries.some((entry) => entry.didChange)) {
    try {
      await writeGigStore(normalizedGigs);
    } catch (error) {
      if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
        throw error;
      }
    }
  }

  return normalizedGigs;
}

async function writeGigStore(gigs: Gig[]) {
  await fs.writeFile(storePath, JSON.stringify(gigs, null, 2), "utf8");
}

function normalizeEquipment(equipment: GigEquipmentItem[]) {
  return equipment.filter((item) => item.quantity > 0);
}

function sanitizeFolderSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function getAllStoredGigs() {
  const gigs = await readGigStore();
  return gigs.sort((left, right) => left.date.localeCompare(right.date));
}

export async function getStoredGigById(gigId: string) {
  const gigs = await readGigStore();
  return gigs.find((gig) => gig.id === gigId);
}

export async function setStoredGigTimeReportFinalApproval(
  gigId: string,
  approvedAt: string | null,
) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const normalizedApprovedAt =
    typeof approvedAt === "string" && approvedAt.trim().length > 0
      ? approvedAt.trim()
      : undefined;

  if (gigs[gigIndex].timeReportFinalApprovedAt === normalizedApprovedAt) {
    return gigs[gigIndex];
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    timeReportFinalApprovedAt: normalizedApprovedAt,
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function clearStoredGigTimeReportFinalApproval(gigId: string) {
  return setStoredGigTimeReportFinalApproval(gigId, null);
}

export async function setStoredGigInvoicesPaid(gigId: string, invoicesPaid: boolean) {
  return updateStoredGigEconomy(gigId, { invoicesPaid });
}

export async function updateStoredGigEconomy(
  gigId: string,
  {
    invoicesPaid,
    economyComment,
  }: { invoicesPaid?: boolean; economyComment?: string },
) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const currentInvoicesPaidAt = gigs[gigIndex].invoicesPaidAt;
  const currentEconomyComment = gigs[gigIndex].economyComment;
  const nextInvoicesPaidAt =
    invoicesPaid === undefined
      ? currentInvoicesPaidAt
      : invoicesPaid
        ? currentInvoicesPaidAt ?? new Date().toISOString()
        : undefined;
  const nextEconomyComment =
    economyComment === undefined ? currentEconomyComment : normalizeOptionalText(economyComment);

  if (
    currentInvoicesPaidAt === nextInvoicesPaidAt &&
    currentEconomyComment === nextEconomyComment
  ) {
    return gigs[gigIndex];
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    invoicesPaidAt: nextInvoicesPaidAt,
    economyComment: nextEconomyComment,
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function closeStoredGig(
  gigId: string,
  {
    overrideUsed = false,
    closedByProfileId,
    closedByName,
  }: {
    overrideUsed?: boolean;
    closedByProfileId?: string;
    closedByName?: string;
  } = {},
) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  if (
    gigs[gigIndex].status === "Closed" &&
    gigs[gigIndex].closeOverrideUsed === overrideUsed &&
    gigs[gigIndex].closedAt
  ) {
    return gigs[gigIndex];
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    status: "Closed",
    progress: 100,
    closedAt: gigs[gigIndex].closedAt ?? new Date().toISOString(),
    closedByProfileId: normalizeOptionalText(closedByProfileId),
    closedByName: normalizeOptionalText(closedByName),
    closeOverrideUsed: overrideUsed || undefined,
    statusBeforeClose:
      gigs[gigIndex].status === "Closed"
        ? gigs[gigIndex].statusBeforeClose
        : gigs[gigIndex].status,
    progressBeforeClose:
      gigs[gigIndex].status === "Closed"
        ? gigs[gigIndex].progressBeforeClose
        : gigs[gigIndex].progress,
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function reopenStoredGig(gigId: string) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const currentGig = gigs[gigIndex];

  if (currentGig.status !== "Closed") {
    return currentGig;
  }

  gigs[gigIndex] = {
    ...currentGig,
    status: resolveReopenedGigStatus(currentGig.statusBeforeClose),
    progress: resolveReopenedGigProgress(
      currentGig.statusBeforeClose,
      currentGig.progressBeforeClose,
    ),
    closedAt: undefined,
    closedByProfileId: undefined,
    closedByName: undefined,
    closeOverrideUsed: undefined,
    statusBeforeClose: undefined,
    progressBeforeClose: undefined,
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function deleteStoredGig(gigId: string) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const deletedGig = gigs[gigIndex];
  gigs.splice(gigIndex, 1);
  await writeGigStore(gigs);

  return deletedGig;
}

export async function createStoredGig(input: NewGigInput) {
  const gigs = await readGigStore();

  const notes = [input.arenaNotes, input.securitySetup, input.generalComments]
    .filter(Boolean)
    .join("\n\n");

  const createdGig: Gig = {
    id: `gig-${randomUUID().slice(0, 8)}`,
    artist: input.artist.trim(),
    arena: input.arena.trim(),
    city: input.city.trim(),
    country: input.country.trim(),
    region: input.city.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    promoter: input.promoter.trim(),
    merchCompany: input.merchCompany.trim(),
    merchRepresentative: input.merchRepresentative.trim(),
    scmRepresentative: input.scmRepresentative.trim(),
    projectManager: input.projectManager?.trim() ?? "",
    ticketsSold: input.ticketsSold,
    estimatedSpendPerVisitor: input.estimatedSpendPerVisitor,
    status: input.status,
    progress: input.status === "Identified" ? 8 : 18,
    staffingProgress: 0,
    alertCount: 0,
    notes: notes || "No operations notes added yet.",
    overviewIndicator: resolveGigOverviewIndicator({
      status: input.status,
      overviewIndicator: undefined,
    }),
    arenaNotes: input.arenaNotes.trim(),
    securitySetup: input.securitySetup.trim(),
    generalComments: input.generalComments.trim(),
    customNoteFields: [],
    equipment: normalizeEquipment(input.equipment),
    temporaryGigManagers: [],
  };

  gigs.push(createdGig);
  await writeGigStore(gigs);
  return createdGig;
}

export async function updateStoredGigEquipment(gigId: string, equipment: GigEquipmentItem[]) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    equipment: normalizeEquipment(equipment),
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function updateStoredGigOverview(gigId: string, input: UpdateGigOverviewInput) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    artist: input.artist.trim(),
    arena: input.arena.trim(),
    city: input.city.trim(),
    country: input.country.trim(),
    region: input.city.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    promoter: input.promoter.trim(),
    merchCompany: input.merchCompany.trim(),
    merchRepresentative: input.merchRepresentative.trim(),
    scmRepresentative: input.scmRepresentative.trim(),
    projectManager: input.projectManager.trim(),
    notes: input.notes.trim(),
    ticketsSold: Math.max(0, input.ticketsSold),
    estimatedSpendPerVisitor: Math.max(0, input.estimatedSpendPerVisitor),
    arenaNotes: input.arenaNotes.trim(),
    securitySetup: input.securitySetup.trim(),
    generalComments: input.generalComments.trim(),
    customNoteFields: input.customNoteFields
      .map((item) => {
        const title = item.title.trim();
        const body = item.body.trim();

        return {
          field: {
            id: item.id.trim(),
            title: title || "Custom heading",
            body,
          },
          hasContent: Boolean(title || body),
        };
      })
      .filter((item) => item.field.id && item.hasContent)
      .map((item) => item.field),
    salesEstimateOverride:
      Math.max(0, input.ticketsSold) * Math.max(0, input.estimatedSpendPerVisitor),
    overviewIndicator: input.overviewIndicator,
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function updateStoredGigProjectManager(gigId: string, projectManager: string) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    projectManager: projectManager.trim(),
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function updateStoredGigImage(gigId: string, profileImageUrl: string) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    profileImageUrl,
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function addStoredGigFile(gigId: string, file: GigFileItem) {
  return addStoredGigFiles(gigId, [file]);
}

export async function addStoredGigFiles(gigId: string, filesToAdd: GigFileItem[]) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  if (filesToAdd.length === 0) {
    return gigs[gigIndex];
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    files: [...filesToAdd, ...(gigs[gigIndex].files ?? [])],
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function removeStoredGigFile(gigId: string, fileId: string) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const currentFiles = gigs[gigIndex].files ?? [];
  const removedFile = currentFiles.find((file) => file.id === fileId);

  if (!removedFile) {
    return null;
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    files: currentFiles.filter((file) => file.id !== fileId),
  };

  await writeGigStore(gigs);

  return {
    gig: gigs[gigIndex],
    removedFile,
  };
}

export async function createStoredGigFolder(
  gigId: string,
  folderName: string,
  section: GigDocumentSection,
) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const trimmedName = folderName.trim();
  const slug = sanitizeFolderSlug(trimmedName);

  if (!trimmedName || !slug) {
    return null;
  }

  const existingFolder = (gigs[gigIndex].fileFolders ?? []).find(
    (folder) => folder.slug === slug && folder.section === section,
  );

  if (existingFolder) {
    return {
      gig: gigs[gigIndex],
      folder: existingFolder,
      alreadyExists: true,
    };
  }

  const createdFolder: GigFileFolder = {
    id: `folder-${randomUUID().slice(0, 8)}`,
    name: trimmedName,
    slug,
    createdAt: new Date().toISOString(),
    section,
  };

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    fileFolders: [...(gigs[gigIndex].fileFolders ?? []), createdFolder],
  };

  await writeGigStore(gigs);

  return {
    gig: gigs[gigIndex],
    folder: createdFolder,
    alreadyExists: false,
  };
}

export async function removeStoredGigFolder(gigId: string, folderId: string) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const currentFolders = gigs[gigIndex].fileFolders ?? [];
  const folderToRemove = currentFolders.find((folder) => folder.id === folderId);

  if (!folderToRemove) {
    return null;
  }

  const normalizedFolderName = normalizeGigDocumentBoxName(folderToRemove.name);
  const hasLinkedFiles = (gigs[gigIndex].files ?? []).some((file) => {
    const folderName = file.folderName?.trim();

    if (!folderName) {
      return false;
    }

    return (
      (file.section ?? "files") === folderToRemove.section &&
      normalizeGigDocumentBoxName(folderName) === normalizedFolderName
    );
  });

  if (hasLinkedFiles) {
    return {
      gig: gigs[gigIndex],
      folder: folderToRemove,
      hasFiles: true,
    };
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    fileFolders: currentFolders.filter((folder) => folder.id !== folderId),
  };

  await writeGigStore(gigs);

  return {
    gig: gigs[gigIndex],
    folder: folderToRemove,
    hasFiles: false,
  };
}

export async function assignStoredGigTemporaryManager(
  gigId: string,
  staffProfileId: string,
) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const normalizedStaffProfileId = staffProfileId.trim();

  if (!normalizedStaffProfileId) {
    return null;
  }

  const existingAssignments = gigs[gigIndex].temporaryGigManagers ?? [];
  const alreadyAssigned = existingAssignments.some(
    (assignment) => assignment.staffProfileId === normalizedStaffProfileId,
  );

  if (alreadyAssigned) {
    return gigs[gigIndex];
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    temporaryGigManagers: [
      ...existingAssignments,
      {
        id: `temp-gig-manager-${randomUUID().slice(0, 8)}`,
        staffProfileId: normalizedStaffProfileId,
        assignedAt: new Date().toISOString(),
      },
    ],
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function removeStoredGigTemporaryManager(
  gigId: string,
  staffProfileId: string,
) {
  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const normalizedStaffProfileId = staffProfileId.trim();
  const currentAssignments = gigs[gigIndex].temporaryGigManagers ?? [];
  const nextAssignments = currentAssignments.filter(
    (assignment) => assignment.staffProfileId !== normalizedStaffProfileId,
  );

  if (nextAssignments.length === currentAssignments.length) {
    return gigs[gigIndex];
  }

  gigs[gigIndex] = {
    ...gigs[gigIndex],
    temporaryGigManagers: nextAssignments,
  };

  await writeGigStore(gigs);
  return gigs[gigIndex];
}

export async function getPlatformAccessibleGigIdsForGigIds(gigIds: string[]) {
  const normalizedGigIds = new Set(gigIds.map((gigId) => gigId.trim()).filter(Boolean));

  if (normalizedGigIds.size === 0) {
    return [] as string[];
  }

  const gigs = await readGigStore();

  return gigs
    .filter((gig) => normalizedGigIds.has(gig.id))
    .filter((gig) => getGigTemporaryManagerTimeline(gig.date).isPlatformAccessible)
    .map((gig) => gig.id);
}

export async function getVisibleGigIdsForGigIds(gigIds: string[]) {
  const normalizedGigIds = new Set(gigIds.map((gigId) => gigId.trim()).filter(Boolean));

  if (normalizedGigIds.size === 0) {
    return [] as string[];
  }

  const gigs = await readGigStore();

  return gigs
    .filter((gig) => normalizedGigIds.has(gig.id))
    .filter((gig) => getGigTemporaryManagerTimeline(gig.date).isVisibleInStaffApp)
    .map((gig) => gig.id);
}

export async function getPlatformAccessibleGigIdsForTemporaryManagerStaffProfile(
  staffProfileId: string,
) {
  const normalizedStaffProfileId = staffProfileId.trim();

  if (!normalizedStaffProfileId) {
    return [] as string[];
  }

  const gigs = await readGigStore();

  return gigs
    .filter((gig) =>
      (gig.temporaryGigManagers ?? []).some(
        (assignment) => assignment.staffProfileId === normalizedStaffProfileId,
      ),
    )
    .filter((gig) => getGigTemporaryManagerTimeline(gig.date).isPlatformAccessible)
    .map((gig) => gig.id);
}

export async function getVisibleTemporaryGigManagerGigsForStaffProfile(
  staffProfileId: string,
) {
  const normalizedStaffProfileId = staffProfileId.trim();

  if (!normalizedStaffProfileId) {
    return [] as Gig[];
  }

  const gigs = await readGigStore();

  return gigs
    .filter((gig) =>
      (gig.temporaryGigManagers ?? []).some(
        (assignment) => assignment.staffProfileId === normalizedStaffProfileId,
      ),
    )
    .filter((gig) => getGigTemporaryManagerTimeline(gig.date).isVisibleInStaffApp)
    .sort((left, right) => left.date.localeCompare(right.date));
}
