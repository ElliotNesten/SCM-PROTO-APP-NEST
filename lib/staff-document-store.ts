import { promises as fs } from "fs";
import path from "path";

import { buildStaffDocumentPdf } from "@/lib/staff-document-pdf";
import {
  ensureProductionStorageSchema,
  getPostgresClient,
  parseJsonValue,
  serializeJson,
} from "@/lib/postgres";
import type { StoredStaffDocument } from "@/types/staff-documents";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-document-store.json");

type StaffDocumentRow = {
  id: string;
  user_id: string;
  gig_id: string;
  shift_id: string;
  gig_date: string;
  generated_at: string;
  document_kind: StoredStaffDocument["documentKind"];
  record_json: string;
};

function logStaffDocumentStoreFallback(action: string, error: unknown) {
  console.error(
    `[staff-document-store] ${action} failed. Falling back to file-backed staff documents.`,
    error,
  );
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
  const normalizedDocumentKind =
    document.documentKind === "Employment Contract"
      ? "Employment Contract"
      : "Time Report";

  return {
    ...document,
    id: document.id.trim(),
    userId: document.userId.trim(),
    gigId: document.gigId.trim(),
    shiftId: document.shiftId.trim(),
    gigName: document.gigName.trim(),
    gigDate: document.gigDate.trim(),
    shiftRole: document.shiftRole.trim(),
    documentKind: normalizedDocumentKind,
    tab:
      normalizedDocumentKind === "Employment Contract"
        ? "employmentContracts"
        : "timeReports",
    generatedAt: document.generatedAt.trim(),
    fileName: document.fileName.trim(),
    fileType: "application/pdf",
    fileSize: Math.max(0, Math.round(document.fileSize)),
  };
}

function mapStaffDocumentRow(row: StaffDocumentRow) {
  const parsedDocument = parseJsonValue<StoredStaffDocument | null>(row.record_json, null);

  if (!parsedDocument) {
    return null;
  }

  return normalizeStoredStaffDocument(parsedDocument);
}

async function getDatabaseStaffDocumentRows() {
  const sql = getPostgresClient();

  if (!sql) {
    return [] as StaffDocumentRow[];
  }

  await ensureProductionStorageSchema();
  return sql<StaffDocumentRow[]>`
    select *
    from staff_documents
  `;
}

async function getDatabaseStaffDocuments() {
  const rows = await getDatabaseStaffDocumentRows();
  return sortStoredStaffDocuments(
    rows
      .map(mapStaffDocumentRow)
      .filter((document): document is StoredStaffDocument => Boolean(document)),
  );
}

async function getDatabaseStaffDocumentsForPerson(personId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return [] as StoredStaffDocument[];
  }

  await ensureProductionStorageSchema();
  const rows = await sql<StaffDocumentRow[]>`
    select *
    from staff_documents
    where user_id = ${personId}
  `;

  return sortStoredStaffDocuments(
    rows
      .map(mapStaffDocumentRow)
      .filter((document): document is StoredStaffDocument => Boolean(document)),
  );
}

async function getDatabaseStaffDocumentById(personId: string, documentId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return null;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<StaffDocumentRow[]>`
    select *
    from staff_documents
    where id = ${documentId} and user_id = ${personId}
    limit 1
  `;

  return rows[0] ? mapStaffDocumentRow(rows[0]) : null;
}

async function replaceDatabaseStaffDocumentsForGig(
  gigId: string,
  nextGigDocuments: StoredStaffDocument[],
) {
  const sql = getPostgresClient();

  if (!sql) {
    return nextGigDocuments;
  }

  await ensureProductionStorageSchema();
  await sql.begin(async (transaction) => {
    const transactionSql = transaction as unknown as typeof sql;

    await transactionSql`
      delete from staff_documents
      where gig_id = ${gigId}
    `;

    for (const document of nextGigDocuments) {
      await transactionSql`
        insert into staff_documents (
          id,
          user_id,
          gig_id,
          shift_id,
          gig_date,
          generated_at,
          document_kind,
          record_json
        ) values (
          ${document.id},
          ${document.userId},
          ${document.gigId},
          ${document.shiftId},
          ${document.gigDate},
          ${document.generatedAt},
          ${document.documentKind},
          ${serializeJson(document)}
        )
        on conflict (id) do update set
          user_id = excluded.user_id,
          gig_id = excluded.gig_id,
          shift_id = excluded.shift_id,
          gig_date = excluded.gig_date,
          generated_at = excluded.generated_at,
          document_kind = excluded.document_kind,
          record_json = excluded.record_json
      `;
    }
  });

  return nextGigDocuments;
}

async function removeDatabaseStaffDocumentsForGig(gigId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return 0;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<{ id: string }[]>`
    delete from staff_documents
    where gig_id = ${gigId}
    returning id
  `;

  return rows.length;
}

async function removeDatabaseStaffDocumentsForPerson(personId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return 0;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<{ id: string }[]>`
    delete from staff_documents
    where user_id = ${personId}
    returning id
  `;

  return rows.length;
}

async function ensureStaffDocumentStore() {
  try {
    await fs.access(storePath);
  } catch {
    try {
      await fs.mkdir(storeDirectory, { recursive: true });
      await fs.writeFile(storePath, JSON.stringify([], null, 2), "utf8");
    } catch (error) {
      if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
        throw error;
      }
    }
  }
}

async function readStaffDocumentStore() {
  try {
    await ensureStaffDocumentStore();
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as StoredStaffDocument[];
    return parsed.map(normalizeStoredStaffDocument);
  } catch (error) {
    if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
      throw error;
    }

    return [] as StoredStaffDocument[];
  }
}

async function writeStaffDocumentStore(documents: StoredStaffDocument[]) {
  await fs.mkdir(storeDirectory, { recursive: true });
  await fs.writeFile(
    storePath,
    JSON.stringify(sortStoredStaffDocuments(documents), null, 2),
    "utf8",
  );
}

async function replaceFileStoredStaffDocumentsForGig(
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

async function removeFileStoredStaffDocumentsForGig(gigId: string) {
  const currentDocuments = await readStaffDocumentStore();
  const nextDocuments = currentDocuments.filter((document) => document.gigId !== gigId);

  if (nextDocuments.length === currentDocuments.length) {
    return 0;
  }

  await writeStaffDocumentStore(nextDocuments);
  return currentDocuments.length - nextDocuments.length;
}

async function removeFileStoredStaffDocumentsForPerson(personId: string) {
  const currentDocuments = await readStaffDocumentStore();
  const nextDocuments = currentDocuments.filter((document) => document.userId !== personId);

  if (nextDocuments.length === currentDocuments.length) {
    return 0;
  }

  await writeStaffDocumentStore(nextDocuments);
  return currentDocuments.length - nextDocuments.length;
}

async function rebuildStoredStaffDocumentForGigMetadata(
  document: StoredStaffDocument,
  {
    gigName,
    gigDate,
  }: {
    gigName: string;
    gigDate: string;
  },
) {
  const nextDocument = normalizeStoredStaffDocument({
    ...document,
    gigName,
    gigDate,
    fileName: buildFileName(gigName, gigDate, document.shiftRole, document.documentKind),
  });

  return {
    ...nextDocument,
    fileSize: (await buildStaffDocumentPdf(nextDocument)).byteLength,
  };
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
  try {
    const databaseDocuments = await getDatabaseStaffDocuments();

    if (databaseDocuments.length > 0) {
      return databaseDocuments;
    }

    return sortStoredStaffDocuments(await readStaffDocumentStore());
  } catch (error) {
    logStaffDocumentStoreFallback("getAllStoredStaffDocuments", error);
    return sortStoredStaffDocuments(await readStaffDocumentStore());
  }
}

export async function getStoredStaffDocuments(personId: string) {
  try {
    const databaseDocuments = await getDatabaseStaffDocumentsForPerson(personId);

    if (databaseDocuments.length > 0) {
      return databaseDocuments;
    }

    const documents = await readStaffDocumentStore();
    return sortStoredStaffDocuments(
      documents.filter((document) => document.userId === personId),
    );
  } catch (error) {
    logStaffDocumentStoreFallback(`getStoredStaffDocuments(${personId})`, error);
    const documents = await readStaffDocumentStore();
    return sortStoredStaffDocuments(
      documents.filter((document) => document.userId === personId),
    );
  }
}

export async function getStoredStaffDocumentById(personId: string, documentId: string) {
  try {
    const databaseDocument = await getDatabaseStaffDocumentById(personId, documentId);

    if (databaseDocument) {
      return databaseDocument;
    }

    const documents = await readStaffDocumentStore();
    return (
      documents.find(
        (document) => document.userId === personId && document.id === documentId,
      ) ?? null
    );
  } catch (error) {
    logStaffDocumentStoreFallback(
      `getStoredStaffDocumentById(${personId}, ${documentId})`,
      error,
    );
    const documents = await readStaffDocumentStore();
    return (
      documents.find(
        (document) => document.userId === personId && document.id === documentId,
      ) ?? null
    );
  }
}

export async function replaceStoredStaffDocumentsForGig(
  gigId: string,
  nextGigDocuments: StoredStaffDocument[],
) {
  const normalizedGigDocuments = nextGigDocuments.map(normalizeStoredStaffDocument);

  try {
    const sql = getPostgresClient();

    if (sql) {
      await replaceDatabaseStaffDocumentsForGig(gigId, normalizedGigDocuments);
      return normalizedGigDocuments;
    }

    return await replaceFileStoredStaffDocumentsForGig(gigId, normalizedGigDocuments);
  } catch (error) {
    logStaffDocumentStoreFallback(`replaceStoredStaffDocumentsForGig(${gigId})`, error);
    return replaceFileStoredStaffDocumentsForGig(gigId, normalizedGigDocuments);
  }
}

export async function removeStoredStaffDocumentsForGig(gigId: string) {
  try {
    const sql = getPostgresClient();

    if (sql) {
      return await removeDatabaseStaffDocumentsForGig(gigId);
    }

    return await removeFileStoredStaffDocumentsForGig(gigId);
  } catch (error) {
    logStaffDocumentStoreFallback(`removeStoredStaffDocumentsForGig(${gigId})`, error);
    return removeFileStoredStaffDocumentsForGig(gigId);
  }
}

export async function removeStoredStaffDocumentsForPerson(personId: string) {
  try {
    const sql = getPostgresClient();

    if (sql) {
      return await removeDatabaseStaffDocumentsForPerson(personId);
    }

    return await removeFileStoredStaffDocumentsForPerson(personId);
  } catch (error) {
    logStaffDocumentStoreFallback(`removeStoredStaffDocumentsForPerson(${personId})`, error);
    return removeFileStoredStaffDocumentsForPerson(personId);
  }
}

export async function syncStoredStaffDocumentsForGigMetadata(
  gigId: string,
  {
    gigName,
    gigDate,
  }: {
    gigName: string;
    gigDate: string;
  },
) {
  const normalizedGigId = gigId.trim();
  const normalizedGigName = normalizeGigName(gigName);
  const normalizedGigDate = gigDate.trim();

  if (!normalizedGigId || !normalizedGigDate) {
    return [] as StoredStaffDocument[];
  }

  const currentGigDocuments = (await getAllStoredStaffDocuments()).filter(
    (document) => document.gigId === normalizedGigId,
  );

  if (currentGigDocuments.length === 0) {
    return [] as StoredStaffDocument[];
  }

  let didChange = false;
  const nextGigDocuments = await Promise.all(
    currentGigDocuments.map(async (document) => {
      const nextFileName = buildFileName(
        normalizedGigName,
        normalizedGigDate,
        document.shiftRole,
        document.documentKind,
      );

      if (
        document.gigName === normalizedGigName &&
        document.gigDate === normalizedGigDate &&
        document.fileName === nextFileName
      ) {
        return normalizeStoredStaffDocument(document);
      }

      didChange = true;
      return rebuildStoredStaffDocumentForGigMetadata(document, {
        gigName: normalizedGigName,
        gigDate: normalizedGigDate,
      });
    }),
  );

  if (didChange) {
    await replaceStoredStaffDocumentsForGig(normalizedGigId, nextGigDocuments);
  }

  return nextGigDocuments;
}
