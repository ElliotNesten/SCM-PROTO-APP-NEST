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
import {
  ensureProductionStorageSchema,
  getPostgresClient,
  isDatabaseConfigured,
  parseJsonValue,
  serializeJson,
} from "@/lib/postgres";
import { syncStoredStaffDocumentsForGigMetadata } from "@/lib/staff-document-store";
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
const globalForGigStore = globalThis as typeof globalThis & {
  __scmGigBootstrapPromise?: Promise<void>;
  __scmGigSnapshot?: Gig[];
};

type GigRow = {
  id: string;
  artist: string;
  date: string;
  country: string;
  status: GigStatus;
  gig_json: string;
};

function logGigStoreFallback(action: string, error: unknown) {
  console.error(`[gig-store] ${action} failed. Falling back to bundled gig data.`, error);
}

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

// Keep the latest successful gig snapshot in memory so transient DB fallbacks
// do not bounce the UI back to stale bundled data between requests.
function cloneGigSnapshot(gigs: Gig[]): Gig[] {
  return sortGigs(gigs).map((gig) => normalizeStoredGig(gig).gig);
}

function getCachedGigSnapshot(): Gig[] | null {
  const snapshot = globalForGigStore.__scmGigSnapshot;
  return snapshot ? cloneGigSnapshot(snapshot) : null;
}

function setCachedGigSnapshot(gigs: Gig[]) {
  globalForGigStore.__scmGigSnapshot = cloneGigSnapshot(gigs);
}

function upsertGigIntoCache(gig: Gig) {
  const current: Gig[] = getCachedGigSnapshot() ?? [];
  const next: Gig[] = current.filter((item) => item.id !== gig.id);
  next.push(gig);
  setCachedGigSnapshot(next);
}

function removeGigFromCache(gigId: string) {
  const current = getCachedGigSnapshot();

  if (!current) {
    return;
  }

  setCachedGigSnapshot(current.filter((gig) => gig.id !== gigId));
}

function getCachedGigById(gigId: string) {
  return getCachedGigSnapshot()?.find((gig) => gig.id === gigId) ?? null;
}

async function ensureGigStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(seedGigs, null, 2), "utf8");
  }
}

function getSeedStoredGigs() {
  return seedGigs.map((gig) => normalizeStoredGig(gig).gig);
}

function sortGigs(gigs: Gig[]) {
  return [...gigs].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);

    if (dateOrder !== 0) {
      return dateOrder;
    }

    return left.artist.localeCompare(right.artist);
  });
}

function mergeUniqueGigs(...collections: Gig[][]) {
  const seenIds = new Set<string>();

  return collections.flat().filter((gig) => {
    if (seenIds.has(gig.id)) {
      return false;
    }

    seenIds.add(gig.id);
    return true;
  });
}

function mapGigRow(row: GigRow) {
  const parsedGig = parseJsonValue<Gig>(row.gig_json, {
    id: row.id,
    artist: row.artist,
    arena: "",
    city: "",
    country: row.country,
    region: "",
    date: row.date,
    startTime: "16:00",
    endTime: "23:00",
    promoter: "",
    merchCompany: "",
    merchRepresentative: "",
    scmRepresentative: "",
    ticketsSold: 0,
    estimatedSpendPerVisitor: 0,
    status: row.status,
    progress: 0,
    staffingProgress: 0,
    alertCount: 0,
    notes: "No operations notes added yet.",
  });

  return normalizeStoredGig({
    ...parsedGig,
    id: row.id,
    artist: parsedGig.artist || row.artist,
    date: parsedGig.date || row.date,
    country: parsedGig.country || row.country,
    status: parsedGig.status || row.status,
  }).gig;
}

async function getDatabaseGigs() {
  const sql = getPostgresClient();

  if (!sql) {
    return [] as Gig[];
  }

  await ensureProductionStorageSchema();
  const rows = await sql<GigRow[]>`
    select id, artist, date, country, status, gig_json
    from gigs
    order by date asc, artist asc
  `;

  return rows.map(mapGigRow);
}

async function getDatabaseGigById(gigId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return null;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<GigRow[]>`
    select id, artist, date, country, status, gig_json
    from gigs
    where id = ${gigId}
    limit 1
  `;

  return rows[0] ? mapGigRow(rows[0]) : null;
}

async function upsertDatabaseGig(gig: Gig) {
  const sql = getPostgresClient();

  if (!sql) {
    return gig;
  }

  await ensureProductionStorageSchema();
  await sql`
    insert into gigs (id, artist, date, country, status, gig_json, created_at, updated_at)
    values (
      ${gig.id},
      ${gig.artist},
      ${gig.date},
      ${gig.country},
      ${gig.status},
      ${serializeJson(gig)},
      ${new Date().toISOString()},
      ${new Date().toISOString()}
    )
    on conflict (id) do update set
      artist = excluded.artist,
      date = excluded.date,
      country = excluded.country,
      status = excluded.status,
      gig_json = excluded.gig_json,
      updated_at = excluded.updated_at
  `;

  return gig;
}

async function deleteDatabaseGig(gigId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return null;
  }

  const existingGig = await getDatabaseGigById(gigId);

  if (!existingGig) {
    return null;
  }

  await ensureProductionStorageSchema();
  await sql`
    delete from gigs
    where id = ${gigId}
  `;

  return existingGig;
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

async function syncGigToFallbackStore(gig: Gig) {
  try {
    const gigs = await readGigStore();
    const gigIndex = gigs.findIndex((item) => item.id === gig.id);

    if (gigIndex === -1) {
      gigs.push(gig);
    } else {
      gigs[gigIndex] = gig;
    }

    await writeGigStore(sortGigs(gigs));
  } catch (error) {
    if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
      throw error;
    }
  }
}

async function removeGigFromFallbackStore(gigId: string) {
  try {
    const gigs = await readGigStore();
    const nextGigs = gigs.filter((gig) => gig.id !== gigId);

    if (nextGigs.length === gigs.length) {
      return;
    }

    await writeGigStore(nextGigs);
  } catch (error) {
    if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
      throw error;
    }
  }
}

async function getFallbackStoredGigs() {
  try {
    const fileBackedGigs = await readGigStore();
    return sortGigs(mergeUniqueGigs(fileBackedGigs, getSeedStoredGigs()));
  } catch {
    return sortGigs(getSeedStoredGigs());
  }
}

async function bootstrapDatabaseGigsFromFallback(fallbackGigs: Gig[]) {
  const sql = getPostgresClient();

  if (!sql || fallbackGigs.length === 0) {
    return;
  }

  if (!globalForGigStore.__scmGigBootstrapPromise) {
    globalForGigStore.__scmGigBootstrapPromise = (async () => {
      await ensureProductionStorageSchema();
      const existingRows = await sql<{ id: string }[]>`
        select id
        from gigs
      `;
      const existingIds = new Set(existingRows.map((row) => row.id));
      const missingGigs = fallbackGigs.filter((gig) => !existingIds.has(gig.id));

      for (const gig of missingGigs) {
        await sql`
          insert into gigs (id, artist, date, country, status, gig_json, created_at, updated_at)
          values (
            ${gig.id},
            ${gig.artist},
            ${gig.date},
            ${gig.country},
            ${gig.status},
            ${serializeJson(gig)},
            ${new Date().toISOString()},
            ${new Date().toISOString()}
          )
          on conflict (id) do nothing
        `;
      }
    })();
  }

  await globalForGigStore.__scmGigBootstrapPromise;
}

async function getMergedStoredGigs() {
  const fallbackGigs = await getFallbackStoredGigs();

  if (!isDatabaseConfigured()) {
    setCachedGigSnapshot(fallbackGigs);
    return fallbackGigs;
  }

  await bootstrapDatabaseGigsFromFallback(fallbackGigs);

  try {
    const databaseGigs = await getDatabaseGigs();
    const resolvedGigs = databaseGigs.length > 0 ? sortGigs(databaseGigs) : fallbackGigs;
    setCachedGigSnapshot(resolvedGigs);
    return resolvedGigs;
  } catch {
    const cachedSnapshot = getCachedGigSnapshot();

    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    setCachedGigSnapshot(fallbackGigs);
    return fallbackGigs;
  }
}

async function updateStoredGigRecord<T>(
  gigId: string,
  updater: (gig: Gig) => { gig: Gig; result: T } | null,
) {
  const sql = getPostgresClient();

  if (sql) {
    const currentGig = await getStoredGigById(gigId);

    if (!currentGig) {
      return null;
    }

    const updated = updater(currentGig);

    if (!updated) {
      return null;
    }

    await upsertDatabaseGig(updated.gig);
    upsertGigIntoCache(updated.gig);
    await syncGigToFallbackStore(updated.gig);
    return updated.result;
  }

  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const updated = updater(gigs[gigIndex]);

  if (!updated) {
    return null;
  }

  gigs[gigIndex] = updated.gig;
  await writeGigStore(gigs);
  setCachedGigSnapshot(gigs);
  return updated.result;
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
  try {
    return await getMergedStoredGigs();
  } catch (error) {
    logGigStoreFallback("getAllStoredGigs", error);
    return getFallbackStoredGigs();
  }
}

export async function getStoredGigById(gigId: string) {
  try {
    if (!isDatabaseConfigured()) {
      const gigs = await readGigStore();
      setCachedGigSnapshot(gigs);
      return gigs.find((gig) => gig.id === gigId);
    }

    const fallbackGigs = await getFallbackStoredGigs();
    await bootstrapDatabaseGigsFromFallback(fallbackGigs);

    try {
      const databaseGig = await getDatabaseGigById(gigId);

      if (databaseGig) {
        upsertGigIntoCache(databaseGig);
        return databaseGig;
      }
    } catch {
      const cachedGig = getCachedGigById(gigId);

      if (cachedGig) {
        return cachedGig;
      }
    }

    const fallbackGig = fallbackGigs.find((gig) => gig.id === gigId) ?? null;

    if (fallbackGig) {
      upsertGigIntoCache(fallbackGig);
    }

    return fallbackGig;
  } catch (error) {
    logGigStoreFallback(`getStoredGigById(${gigId})`, error);
    const cachedGig = getCachedGigById(gigId);

    if (cachedGig) {
      return cachedGig;
    }

    const fallbackGigs = await getFallbackStoredGigs();
    const fallbackGig = fallbackGigs.find((gig) => gig.id === gigId) ?? null;

    if (fallbackGig) {
      upsertGigIntoCache(fallbackGig);
    }

    return fallbackGig;
  }
}

export async function setStoredGigTimeReportFinalApproval(
  gigId: string,
  approvedAt: string | null,
) {
  return updateStoredGigRecord(gigId, (gig) => {
    const normalizedApprovedAt =
      typeof approvedAt === "string" && approvedAt.trim().length > 0
        ? approvedAt.trim()
        : undefined;

    if (gig.timeReportFinalApprovedAt === normalizedApprovedAt) {
      return { gig, result: gig };
    }

    const updatedGig = {
      ...gig,
      timeReportFinalApprovedAt: normalizedApprovedAt,
    };

    return { gig: updatedGig, result: updatedGig };
  });
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
  return updateStoredGigRecord(gigId, (gig) => {
    const currentInvoicesPaidAt = gig.invoicesPaidAt;
    const currentEconomyComment = gig.economyComment;
    const nextInvoicesPaidAt =
      invoicesPaid === undefined
        ? currentInvoicesPaidAt
        : invoicesPaid
          ? currentInvoicesPaidAt ?? new Date().toISOString()
          : undefined;
    const nextEconomyComment =
      economyComment === undefined
        ? currentEconomyComment
        : normalizeOptionalText(economyComment);

    if (
      currentInvoicesPaidAt === nextInvoicesPaidAt &&
      currentEconomyComment === nextEconomyComment
    ) {
      return { gig, result: gig };
    }

    const updatedGig = {
      ...gig,
      invoicesPaidAt: nextInvoicesPaidAt,
      economyComment: nextEconomyComment,
    };

    return { gig: updatedGig, result: updatedGig };
  });
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
  return updateStoredGigRecord(gigId, (gig) => {
    if (gig.status === "Closed" && gig.closeOverrideUsed === overrideUsed && gig.closedAt) {
      return { gig, result: gig };
    }

    const updatedGig = {
      ...gig,
      status: "Closed" as const,
      progress: 100,
      closedAt: gig.closedAt ?? new Date().toISOString(),
      closedByProfileId: normalizeOptionalText(closedByProfileId),
      closedByName: normalizeOptionalText(closedByName),
      closeOverrideUsed: overrideUsed || undefined,
      statusBeforeClose: gig.status === "Closed" ? gig.statusBeforeClose : gig.status,
      progressBeforeClose:
        gig.status === "Closed" ? gig.progressBeforeClose : gig.progress,
    };

    return { gig: updatedGig, result: updatedGig };
  });
}

export async function reopenStoredGig(gigId: string) {
  return updateStoredGigRecord(gigId, (gig) => {
    if (gig.status !== "Closed") {
      return { gig, result: gig };
    }

    const updatedGig = {
      ...gig,
      status: resolveReopenedGigStatus(gig.statusBeforeClose),
      progress: resolveReopenedGigProgress(
        gig.statusBeforeClose,
        gig.progressBeforeClose,
      ),
      closedAt: undefined,
      closedByProfileId: undefined,
      closedByName: undefined,
      closeOverrideUsed: undefined,
      statusBeforeClose: undefined,
      progressBeforeClose: undefined,
    };

    return { gig: updatedGig, result: updatedGig };
  });
}

export async function deleteStoredGig(gigId: string) {
  const sql = getPostgresClient();

  if (sql) {
    const deletedGig = await deleteDatabaseGig(gigId);

    if (deletedGig) {
      removeGigFromCache(gigId);
      await removeGigFromFallbackStore(gigId);
    }

    return deletedGig;
  }

  const gigs = await readGigStore();
  const gigIndex = gigs.findIndex((gig) => gig.id === gigId);

  if (gigIndex === -1) {
    return null;
  }

  const deletedGig = gigs[gigIndex];
  gigs.splice(gigIndex, 1);
  await writeGigStore(gigs);
  setCachedGigSnapshot(gigs);

  return deletedGig;
}

export async function createStoredGig(input: NewGigInput) {
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

  const sql = getPostgresClient();

  if (sql) {
    await upsertDatabaseGig(createdGig);
    upsertGigIntoCache(createdGig);
    await syncGigToFallbackStore(createdGig);
    return createdGig;
  }

  const gigs = await readGigStore();
  gigs.push(createdGig);
  await writeGigStore(gigs);
  setCachedGigSnapshot(gigs);
  return createdGig;
}

export async function updateStoredGigEquipment(gigId: string, equipment: GigEquipmentItem[]) {
  return updateStoredGigRecord(gigId, (gig) => {
    const updatedGig = {
      ...gig,
      equipment: normalizeEquipment(equipment),
    };

    return { gig: updatedGig, result: updatedGig };
  });
}

export async function updateStoredGigOverview(gigId: string, input: UpdateGigOverviewInput) {
  const updatedGig = await updateStoredGigRecord(gigId, (gig) => {
    const updatedGig = {
      ...gig,
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

    return { gig: updatedGig, result: updatedGig };
  });

  if (!updatedGig) {
    return null;
  }

  await syncStoredStaffDocumentsForGigMetadata(updatedGig.id, {
    gigName: updatedGig.artist,
    gigDate: updatedGig.date,
  });

  return updatedGig;
}

export async function updateStoredGigProjectManager(gigId: string, projectManager: string) {
  return updateStoredGigRecord(gigId, (gig) => {
    const updatedGig = {
      ...gig,
      projectManager: projectManager.trim(),
    };

    return { gig: updatedGig, result: updatedGig };
  });
}

export async function updateStoredGigImage(gigId: string, profileImageUrl: string) {
  return updateStoredGigRecord(gigId, (gig) => {
    const updatedGig = {
      ...gig,
      profileImageUrl,
    };

    return { gig: updatedGig, result: updatedGig };
  });
}

export async function addStoredGigFile(gigId: string, file: GigFileItem) {
  return addStoredGigFiles(gigId, [file]);
}

export async function addStoredGigFiles(gigId: string, filesToAdd: GigFileItem[]) {
  return updateStoredGigRecord(gigId, (gig) => {
    if (filesToAdd.length === 0) {
      return { gig, result: gig };
    }

    const updatedGig = {
      ...gig,
      files: [...filesToAdd, ...(gig.files ?? [])],
    };

    return { gig: updatedGig, result: updatedGig };
  });
}

export async function removeStoredGigFile(gigId: string, fileId: string) {
  return updateStoredGigRecord(gigId, (gig) => {
    const currentFiles = gig.files ?? [];
    const removedFile = currentFiles.find((file) => file.id === fileId);

    if (!removedFile) {
      return null;
    }

    const updatedGig = {
      ...gig,
      files: currentFiles.filter((file) => file.id !== fileId),
    };

    return {
      gig: updatedGig,
      result: {
        gig: updatedGig,
        removedFile,
      },
    };
  });
}

export async function createStoredGigFolder(
  gigId: string,
  folderName: string,
  section: GigDocumentSection,
) {
  return updateStoredGigRecord(gigId, (gig) => {
    const trimmedName = folderName.trim();
    const slug = sanitizeFolderSlug(trimmedName);

    if (!trimmedName || !slug) {
      return null;
    }

    const existingFolder = (gig.fileFolders ?? []).find(
      (folder) => folder.slug === slug && folder.section === section,
    );

    if (existingFolder) {
      return {
        gig,
        result: {
          gig,
          folder: existingFolder,
          alreadyExists: true,
        },
      };
    }

    const createdFolder: GigFileFolder = {
      id: `folder-${randomUUID().slice(0, 8)}`,
      name: trimmedName,
      slug,
      createdAt: new Date().toISOString(),
      section,
    };
    const updatedGig = {
      ...gig,
      fileFolders: [...(gig.fileFolders ?? []), createdFolder],
    };

    return {
      gig: updatedGig,
      result: {
        gig: updatedGig,
        folder: createdFolder,
        alreadyExists: false,
      },
    };
  });
}

export async function removeStoredGigFolder(gigId: string, folderId: string) {
  return updateStoredGigRecord(gigId, (gig) => {
    const currentFolders = gig.fileFolders ?? [];
    const folderToRemove = currentFolders.find((folder) => folder.id === folderId);

    if (!folderToRemove) {
      return null;
    }

    const normalizedFolderName = normalizeGigDocumentBoxName(folderToRemove.name);
    const hasLinkedFiles = (gig.files ?? []).some((file) => {
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
        gig,
        result: {
          gig,
          folder: folderToRemove,
          hasFiles: true,
        },
      };
    }

    const updatedGig = {
      ...gig,
      fileFolders: currentFolders.filter((folder) => folder.id !== folderId),
    };

    return {
      gig: updatedGig,
      result: {
        gig: updatedGig,
        folder: folderToRemove,
        hasFiles: false,
      },
    };
  });
}

export async function assignStoredGigTemporaryManager(
  gigId: string,
  staffProfileId: string,
) {
  return updateStoredGigRecord(gigId, (gig) => {
    const normalizedStaffProfileId = staffProfileId.trim();

    if (!normalizedStaffProfileId) {
      return null;
    }

    const existingAssignments = gig.temporaryGigManagers ?? [];
    const alreadyAssigned = existingAssignments.some(
      (assignment) => assignment.staffProfileId === normalizedStaffProfileId,
    );

    if (alreadyAssigned) {
      return { gig, result: gig };
    }

    const updatedGig = {
      ...gig,
      temporaryGigManagers: [
        ...existingAssignments,
        {
          id: `temp-gig-manager-${randomUUID().slice(0, 8)}`,
          staffProfileId: normalizedStaffProfileId,
          assignedAt: new Date().toISOString(),
        },
      ],
    };

    return { gig: updatedGig, result: updatedGig };
  });
}

export async function removeStoredGigTemporaryManager(
  gigId: string,
  staffProfileId: string,
) {
  return updateStoredGigRecord(gigId, (gig) => {
    const normalizedStaffProfileId = staffProfileId.trim();
    const currentAssignments = gig.temporaryGigManagers ?? [];
    const nextAssignments = currentAssignments.filter(
      (assignment) => assignment.staffProfileId !== normalizedStaffProfileId,
    );

    if (nextAssignments.length === currentAssignments.length) {
      return { gig, result: gig };
    }

    const updatedGig = {
      ...gig,
      temporaryGigManagers: nextAssignments,
    };

    return { gig: updatedGig, result: updatedGig };
  });
}

export async function getPlatformAccessibleGigIdsForGigIds(gigIds: string[]) {
  const normalizedGigIds = new Set(gigIds.map((gigId) => gigId.trim()).filter(Boolean));

  if (normalizedGigIds.size === 0) {
    return [] as string[];
  }

  const gigs = await getAllStoredGigs();

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

  const gigs = await getAllStoredGigs();

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

  const gigs = await getAllStoredGigs();

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

  const gigs = await getAllStoredGigs();

  return gigs
    .filter((gig) =>
      (gig.temporaryGigManagers ?? []).some(
        (assignment) => assignment.staffProfileId === normalizedStaffProfileId,
      ),
    )
    .filter((gig) => getGigTemporaryManagerTimeline(gig.date).isVisibleInStaffApp)
    .sort((left, right) => left.date.localeCompare(right.date));
}
