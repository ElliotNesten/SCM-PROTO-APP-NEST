import { randomUUID } from "node:crypto";
import path from "node:path";

import { NextResponse } from "next/server";

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
  getSystemScmInfoPdfSettings,
  updateSystemScmInfoPdfSettings,
  updateSystemScmInfoItemPdf,
  updateSystemScmInfoSectionPdf,
} from "@/lib/system-scm-info-pdf-store";
import {
  createEmptyStaffAppScmInfoPdfAsset,
  STAFF_APP_SCM_INFO_PDF_LIMIT,
  getSystemScmInfoItemPdfKey,
  type StaffAppScmInfoItemPdfSectionKey,
  staffAppScmInfoItemPdfSectionKeys,
  staffAppScmInfoPdfSectionKeys,
} from "@/lib/system-scm-info-pdf-shared";
import type { StaffAppScmInfoSectionKey } from "@/lib/system-scm-info-store";

export const runtime = "nodejs";

const publicRootDirectory = path.join(process.cwd(), "public");
const scmInfoPdfRootDirectory = path.join(publicRootDirectory, "system-scm-info-pdfs");

function isStaffAppScmInfoSectionKey(value: string): value is StaffAppScmInfoSectionKey {
  return staffAppScmInfoPdfSectionKeys.includes(value as StaffAppScmInfoSectionKey);
}

function isStaffAppScmInfoItemPdfSectionKey(
  value: string,
): value is StaffAppScmInfoItemPdfSectionKey {
  return staffAppScmInfoItemPdfSectionKeys.includes(
    value as StaffAppScmInfoItemPdfSectionKey,
  );
}

function sanitizeFileBaseName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function requireSuperAdminApiProfile() {
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Sign in to access System Settings." }, { status: 401 });
  }

  if (!isSuperAdminRole(currentProfile.roleKey)) {
    return NextResponse.json(
      { error: "Only Super Admin can update SCM guide PDFs." },
      { status: 403 },
    );
  }

  return currentProfile;
}

export async function GET() {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const pdfs = await getSystemScmInfoPdfSettings();

  return NextResponse.json({
    pdfs,
  });
}

export async function POST(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const formData = await request.formData();
  const targetType = String(formData.get("targetType") ?? "").trim();
  const sectionId = String(formData.get("sectionId") ?? "").trim();
  const itemIndexRaw = String(formData.get("itemIndex") ?? "").trim();
  const slotIndexRaw = String(formData.get("slotIndex") ?? "").trim();
  const buttonLabel = String(formData.get("buttonLabel") ?? "").trim();
  const uploadedEntry = formData.get("file");

  if (!(uploadedEntry instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF document to upload." }, { status: 400 });
  }

  if (!isStaffAppScmInfoSectionKey(sectionId)) {
    return NextResponse.json({ error: "Unknown SCM guide section." }, { status: 400 });
  }

  const fileExtension = path.extname(uploadedEntry.name).toLowerCase().replace(".", "");
  const isAllowedType = fileExtension === "pdf" || uploadedEntry.type === "application/pdf";

  if (!isAllowedType) {
    return NextResponse.json({ error: "Only PDF documents are supported." }, { status: 400 });
  }

  const existingPdfs = await getSystemScmInfoPdfSettings();
  const slotIndex = Number.parseInt(slotIndexRaw, 10);

  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= STAFF_APP_SCM_INFO_PDF_LIMIT
  ) {
    return NextResponse.json({ error: "Choose a valid PDF slot." }, { status: 400 });
  }

  const baseName = sanitizeFileBaseName(path.parse(uploadedEntry.name).name) || "scm-guide";
  const uniqueSuffix = randomUUID().slice(0, 8);
  const storageFileName = `${baseName}-${uniqueSuffix}.pdf`;
  try {
    const pdfUrl = await storePublicUpload({
      blobPath: `system-scm-info-pdfs/${storageFileName}`,
      file: uploadedEntry,
      localDirectory: scmInfoPdfRootDirectory,
      localFileName: storageFileName,
      localUrlPath: `/system-scm-info-pdfs/${storageFileName}`,
    });
    let updatedPdfs = existingPdfs;

    if (targetType === "section") {
      const currentAsset = existingPdfs.sectionPdfs[sectionId][slotIndex];
      updatedPdfs = await updateSystemScmInfoSectionPdf(sectionId, slotIndex, {
        pdfUrl,
        fileName: uploadedEntry.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentProfile.displayName,
        buttonLabel:
          buttonLabel || currentAsset?.buttonLabel || path.parse(uploadedEntry.name).name,
      });
      await deleteStoredPublicUpload({
        fileUrl: currentAsset?.pdfUrl,
        localUrlPrefix: "/system-scm-info-pdfs/",
        localRootDirectory: scmInfoPdfRootDirectory,
      });
    } else if (targetType === "item") {
      if (!isStaffAppScmInfoItemPdfSectionKey(sectionId)) {
        await deleteStoredPublicUpload({
          fileUrl: pdfUrl,
          localUrlPrefix: "/system-scm-info-pdfs/",
          localRootDirectory: scmInfoPdfRootDirectory,
        });
        return NextResponse.json(
          { error: "This SCM guide section does not support entry PDFs." },
          { status: 400 },
        );
      }

      const itemIndex = Number.parseInt(itemIndexRaw, 10);

      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        await deleteStoredPublicUpload({
          fileUrl: pdfUrl,
          localUrlPrefix: "/system-scm-info-pdfs/",
          localRootDirectory: scmInfoPdfRootDirectory,
        });
        return NextResponse.json({ error: "Choose a valid guide entry." }, { status: 400 });
      }

      const itemKey = getSystemScmInfoItemPdfKey(sectionId, itemIndex);
      const currentAsset = existingPdfs.itemPdfs[itemKey]?.[slotIndex];
      updatedPdfs = await updateSystemScmInfoItemPdf(sectionId, itemIndex, slotIndex, {
        pdfUrl,
        fileName: uploadedEntry.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentProfile.displayName,
        buttonLabel:
          buttonLabel || currentAsset?.buttonLabel || path.parse(uploadedEntry.name).name,
      });
      await deleteStoredPublicUpload({
        fileUrl: currentAsset?.pdfUrl,
        localUrlPrefix: "/system-scm-info-pdfs/",
        localRootDirectory: scmInfoPdfRootDirectory,
      });
    } else {
      await deleteStoredPublicUpload({
        fileUrl: pdfUrl,
        localUrlPrefix: "/system-scm-info-pdfs/",
        localRootDirectory: scmInfoPdfRootDirectory,
      });
      return NextResponse.json(
        { error: "Choose where the PDF should be attached." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      pdfs: updatedPdfs,
    });
  } catch (error) {
    if (error instanceof PublicUploadStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Could not upload SCM info PDF", error);
    return NextResponse.json(
      { error: "Could not upload the SCM guide PDF right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        pdfs?: Awaited<ReturnType<typeof getSystemScmInfoPdfSettings>>;
      }
    | null;

  if (!payload?.pdfs) {
    return NextResponse.json({ error: "Missing SCM guide PDFs payload." }, { status: 400 });
  }

  const updatedPdfs = await updateSystemScmInfoPdfSettings(payload.pdfs);

  return NextResponse.json({
    ok: true,
    pdfs: updatedPdfs,
  });
}

export async function DELETE(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        targetType?: string;
        sectionId?: string;
        itemIndex?: number;
        slotIndex?: number;
      }
    | null;

  const targetType = payload?.targetType?.trim() ?? "";
  const sectionId = payload?.sectionId?.trim() ?? "";
  const slotIndex = payload?.slotIndex;

  if (!isStaffAppScmInfoSectionKey(sectionId)) {
    return NextResponse.json({ error: "Unknown SCM guide section." }, { status: 400 });
  }

  if (
    typeof slotIndex !== "number" ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= STAFF_APP_SCM_INFO_PDF_LIMIT
  ) {
    return NextResponse.json({ error: "Choose a valid PDF slot." }, { status: 400 });
  }

  const validSlotIndex = slotIndex;

  const existingPdfs = await getSystemScmInfoPdfSettings();
  let updatedPdfs = existingPdfs;

  if (targetType === "section") {
    const currentAsset = existingPdfs.sectionPdfs[sectionId][validSlotIndex];
    await deleteStoredPublicUpload({
      fileUrl: currentAsset?.pdfUrl,
      localUrlPrefix: "/system-scm-info-pdfs/",
      localRootDirectory: scmInfoPdfRootDirectory,
    });
    updatedPdfs = await updateSystemScmInfoSectionPdf(
      sectionId,
      validSlotIndex,
      createEmptyStaffAppScmInfoPdfAsset(),
    );
  } else if (targetType === "item") {
    if (!isStaffAppScmInfoItemPdfSectionKey(sectionId)) {
      return NextResponse.json(
        { error: "This SCM guide section does not support entry PDFs." },
        { status: 400 },
      );
    }

    const itemIndex = payload?.itemIndex;

    if (typeof itemIndex !== "number" || !Number.isInteger(itemIndex) || itemIndex < 0) {
      return NextResponse.json({ error: "Choose a valid guide entry." }, { status: 400 });
    }

    const validItemIndex = itemIndex;
    const itemKey = getSystemScmInfoItemPdfKey(sectionId, validItemIndex);
    const currentAsset = existingPdfs.itemPdfs[itemKey]?.[validSlotIndex];
    await deleteStoredPublicUpload({
      fileUrl: currentAsset?.pdfUrl,
      localUrlPrefix: "/system-scm-info-pdfs/",
      localRootDirectory: scmInfoPdfRootDirectory,
    });
    updatedPdfs = await updateSystemScmInfoItemPdf(
      sectionId,
      validItemIndex,
      validSlotIndex,
      createEmptyStaffAppScmInfoPdfAsset(),
    );
  } else {
    return NextResponse.json({ error: "Choose where the PDF should be removed." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    pdfs: updatedPdfs,
  });
}
