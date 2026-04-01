import { randomUUID } from "node:crypto";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  arenaCatalogDocumentKeys,
  createEmptyArenaCatalogDocumentAsset,
  type ArenaCatalogDocumentKey,
} from "@/data/predefined-arenas";
import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import {
  PublicUploadStorageError,
  deleteStoredPublicUpload,
  storePublicUpload,
} from "@/lib/public-file-storage";
import {
  getSystemScmInfoSettings,
  updateSystemScmInfoSettings,
} from "@/lib/system-scm-info-store";

export const runtime = "nodejs";

const publicRootDirectory = path.join(process.cwd(), "public");
const arenaDocumentRootDirectory = path.join(publicRootDirectory, "system-scm-arena-documents");

function isArenaCatalogDocumentKey(value: string): value is ArenaCatalogDocumentKey {
  return arenaCatalogDocumentKeys.includes(value as ArenaCatalogDocumentKey);
}

function sanitizeFileBaseName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function requireSuperAdminApiProfile() {
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Sign in to access System Settings." }, { status: 401 });
  }

  if (!isSuperAdminRole(currentProfile.roleKey)) {
    return NextResponse.json(
      { error: "Only Super Admin can update arena PDFs." },
      { status: 403 },
    );
  }

  return currentProfile;
}

async function getArenaDocumentContext(arenaId: string) {
  const currentSettings = await getSystemScmInfoSettings();
  const targetArena = currentSettings.arenaInfo.catalog.find((arena) => arena.id === arenaId);

  return {
    currentSettings,
    targetArena,
  };
}

async function persistArenaDocument(
  currentSettings: Awaited<ReturnType<typeof getSystemScmInfoSettings>>,
  arenaId: string,
  documentKey: ArenaCatalogDocumentKey,
  documentAsset: ReturnType<typeof createEmptyArenaCatalogDocumentAsset>,
) {
  return updateSystemScmInfoSettings({
    ...currentSettings,
    arenaInfo: {
      ...currentSettings.arenaInfo,
      catalog: currentSettings.arenaInfo.catalog.map((arena) =>
        arena.id === arenaId
          ? {
              ...arena,
              documents: {
                ...arena.documents,
                [documentKey]: documentAsset,
              },
            }
          : arena,
      ),
    },
  });
}

export async function POST(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const formData = await request.formData();
  const arenaId = String(formData.get("arenaId") ?? "").trim();
  const documentKey = String(formData.get("documentKey") ?? "").trim();
  const uploadedEntry = formData.get("file");

  if (!arenaId) {
    return NextResponse.json({ error: "Choose a valid arena." }, { status: 400 });
  }

  if (!isArenaCatalogDocumentKey(documentKey)) {
    return NextResponse.json({ error: "Choose a valid arena document." }, { status: 400 });
  }

  if (!(uploadedEntry instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF document to upload." }, { status: 400 });
  }

  const fileExtension = path.extname(uploadedEntry.name).toLowerCase().replace(".", "");
  const isAllowedType = fileExtension === "pdf" || uploadedEntry.type === "application/pdf";

  if (!isAllowedType) {
    return NextResponse.json({ error: "Only PDF documents are supported." }, { status: 400 });
  }

  const { currentSettings, targetArena } = await getArenaDocumentContext(arenaId);

  if (!targetArena || !currentSettings) {
    return NextResponse.json(
      { error: "Save the arena catalog first before uploading arena PDFs." },
      { status: 400 },
    );
  }

  const currentDocument = targetArena.documents[documentKey];
  const baseName =
    sanitizeFileBaseName(
      `${arenaId}-${documentKey}-${path.parse(uploadedEntry.name).name}`,
    ) || "arena-document";
  const storageFileName = `${baseName}-${randomUUID().slice(0, 8)}.pdf`;
  let uploadedPdfUrl = "";

  try {
    uploadedPdfUrl = await storePublicUpload({
      blobPath: `system-scm-arena-documents/${storageFileName}`,
      file: uploadedEntry,
      localDirectory: arenaDocumentRootDirectory,
      localFileName: storageFileName,
      localUrlPath: `/system-scm-arena-documents/${storageFileName}`,
    });

    const nextSettings = await persistArenaDocument(currentSettings, arenaId, documentKey, {
      pdfUrl: uploadedPdfUrl,
      fileName: uploadedEntry.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentProfile.displayName,
    });

    await deleteStoredPublicUpload({
      fileUrl: currentDocument?.pdfUrl,
      localUrlPrefix: "/system-scm-arena-documents/",
      localRootDirectory: arenaDocumentRootDirectory,
    });

    return NextResponse.json({
      ok: true,
      settings: nextSettings,
    });
  } catch (error) {
    if (uploadedPdfUrl) {
      await deleteStoredPublicUpload({
        fileUrl: uploadedPdfUrl,
        localUrlPrefix: "/system-scm-arena-documents/",
        localRootDirectory: arenaDocumentRootDirectory,
      }).catch(() => undefined);
    }

    if (error instanceof PublicUploadStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Could not upload arena PDF", error);
    return NextResponse.json(
      { error: "Could not upload the arena PDF right now." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        arenaId?: string;
        documentKey?: string;
      }
    | null;

  const arenaId = payload?.arenaId?.trim() ?? "";
  const documentKey = payload?.documentKey?.trim() ?? "";

  if (!arenaId) {
    return NextResponse.json({ error: "Choose a valid arena." }, { status: 400 });
  }

  if (!isArenaCatalogDocumentKey(documentKey)) {
    return NextResponse.json({ error: "Choose a valid arena document." }, { status: 400 });
  }

  const currentSettings = await getSystemScmInfoSettings();
  const targetArena = currentSettings.arenaInfo.catalog.find((arena) => arena.id === arenaId);

  if (!targetArena) {
    return NextResponse.json({ error: "Choose a valid arena." }, { status: 400 });
  }

  const currentDocument = targetArena.documents[documentKey];

  await deleteStoredPublicUpload({
    fileUrl: currentDocument?.pdfUrl,
    localUrlPrefix: "/system-scm-arena-documents/",
    localRootDirectory: arenaDocumentRootDirectory,
  });

  const nextSettings = await updateSystemScmInfoSettings({
    ...currentSettings,
    arenaInfo: {
      ...currentSettings.arenaInfo,
      catalog: currentSettings.arenaInfo.catalog.map((arena) =>
        arena.id === arenaId
          ? {
              ...arena,
              documents: {
                ...arena.documents,
                [documentKey]: createEmptyArenaCatalogDocumentAsset(),
              },
            }
          : arena,
      ),
    },
  });

  return NextResponse.json({
    ok: true,
    settings: nextSettings,
  });
}
