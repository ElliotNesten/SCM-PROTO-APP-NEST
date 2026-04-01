import { promises as fs } from "fs";
import path from "path";

import { buildStaffDocumentPdf } from "@/lib/staff-document-pdf";
import type { StoredStaffDocument } from "@/types/staff-documents";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-document-store.json");

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeGigName(gigName: string) {
  return gigName.trim() || "gig";
}

function buildDocumentId(
  staffId: string,
  shiftId: string,
  kind: StoredStaffDocument["documentKind"],
) {
  const suffix = kind === "Employment Contract" ? "contract" : "time-report";
  return `staffdoc-${staffId}-${shiftId}-${suffix}`;
}

function buildFileName(
  gigName: string,
  gigDate: string,
  shiftRole: string,
  kind: StoredStaffDocument["documentKind"],
) {
  const base = slugify(`${normalizeGigName(gigName)}-${gigDate}-${shiftRole}`);
  const suffix = kind === "Employment Contract" ? "employment-contract" : "time-report";

  return `${base || "staff-document"}-${suffix}.pdf`;
}

function sortStoredStaffDocuments(documents: StoredStaffDocument[]) {
  return [...documents].sort((left, right) => {
    if (left.gigDate !== right.gigDate) {
      return right.gigDate.localeCompare(left.gigDate);
    }

    if (left.generatedAt !== right.generatedAt) {
      return right.generatedAt.localeCompare(left.generatedAt);
    }

    return left.fileName.localeCompare(right.fileName);
  });
}

function normalizeStoredStaffDocument(document: StoredStaffDocument): StoredStaffDocument {
  return {
    ...document,
    id: document.id.trim(),
    userId: document.userId.trim(),
    gigId: document.gigId.trim(),
    shiftId: document.shiftId.trim(),
    gigName: document.gigName.trim(),
    gigDate: document.gigDate.trim(),
    shiftRole: document.shiftRole.trim(),
    generatedAt: document.generatedAt.trim(),
    fileName: document.fileName.trim(),
    fileSize: Math.max(0, Math.round(document.fileSize)),
  };
}

async function ensureStaffDocumentStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify([], null, 2), "utf8");
  }
}

async function readStaffDocumentStore() {
  await ensureStaffDocumentStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as StoredStaffDocument[];
  return parsed.map(normalizeStoredStaffDocument);
}

async function writeStaffDocumentStore(documents: StoredStaffDocument[]) {
  await fs.writeFile(
    storePath,
    JSON.stringify(sortStoredStaffDocuments(documents), null, 2),
    "utf8",
  );
}

export async function buildStoredStaffDocumentRecord({
  userId,
  gigId,
  shiftId,
  gigName,
  gigDate,
  shiftRole,
  documentKind,
  generatedAt,
  generatedBy = "timeReportApproved",
}: {
  userId: string;
  gigId: string;
  shiftId: string;
  gigName: string;
  gigDate: string;
  shiftRole: string;
  documentKind: StoredStaffDocument["documentKind"];
  generatedAt: string;
  generatedBy?: StoredStaffDocument["generatedBy"];
}): Promise<StoredStaffDocument> {
  const record: StoredStaffDocument = {
    id: buildDocumentId(userId, shiftId, documentKind),
    userId,
    gigId,
    shiftId,
    gigName,
    gigDate,
    shiftRole,
    documentKind,
    tab: documentKind === "Employment Contract" ? "employmentContracts" : "timeReports",
    generatedAt,
    generatedBy,
    fileName: buildFileName(gigName, gigDate, shiftRole, documentKind),
    fileType: "application/pdf",
    fileSize: 0,
  };

  return {
    ...record,
    fileSize: (await buildStaffDocumentPdf(record)).byteLength,
  };
}

export async function getAllStoredStaffDocuments() {
  return sortStoredStaffDocuments(await readStaffDocumentStore());
}

export async function getStoredStaffDocuments(personId: string) {
  const documents = await getAllStoredStaffDocuments();
  return documents.filter((document) => document.userId === personId);
}

export async function getStoredStaffDocumentById(
  personId: string,
  documentId: string,
) {
  const documents = await getStoredStaffDocuments(personId);
  return documents.find((document) => document.id === documentId) ?? null;
}

export async function replaceStoredStaffDocumentsForGig(
  gigId: string,
  nextGigDocuments: StoredStaffDocument[],
) {
  const currentDocuments = await readStaffDocumentStore();
  const remainingDocuments = currentDocuments.filter((document) => document.gigId !== gigId);
  const normalizedGigDocuments = nextGigDocuments.map(normalizeStoredStaffDocument);
  const nextDocuments = sortStoredStaffDocuments([
    ...remainingDocuments,
    ...normalizedGigDocuments,
  ]);

  await writeStaffDocumentStore(nextDocuments);
  return normalizedGigDocuments;
}

export async function removeStoredStaffDocumentsForGig(gigId: string) {
  const currentDocuments = await readStaffDocumentStore();
  const nextDocuments = currentDocuments.filter((document) => document.gigId !== gigId);

  if (nextDocuments.length === currentDocuments.length) {
    return 0;
  }

  await writeStaffDocumentStore(nextDocuments);
  return currentDocuments.length - nextDocuments.length;
}

export async function removeStoredStaffDocumentsForPerson(personId: string) {
  const currentDocuments = await readStaffDocumentStore();
  const nextDocuments = currentDocuments.filter((document) => document.userId !== personId);

  if (nextDocuments.length === currentDocuments.length) {
    return 0;
  }

  await writeStaffDocumentStore(nextDocuments);
  return currentDocuments.length - nextDocuments.length;
}
