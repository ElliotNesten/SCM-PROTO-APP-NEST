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
  getSystemPolicySettings,
  updateSystemPolicySettings,
} from "@/lib/system-policy-store";

export const runtime = "nodejs";

const publicRootDirectory = path.join(process.cwd(), "public");
const policyRootDirectory = path.join(publicRootDirectory, "system-policies");

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
      { error: "Only Super Admin can update the SCM policy." },
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

  const policy = await getSystemPolicySettings();

  return NextResponse.json({
    policy,
  });
}

export async function POST(request: Request) {
  const currentProfile = await requireSuperAdminApiProfile();

  if (currentProfile instanceof NextResponse) {
    return currentProfile;
  }

  const existingPolicy = await getSystemPolicySettings();
  const formData = await request.formData();
  const uploadedEntry = formData.get("file");

  if (!(uploadedEntry instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF document to upload." }, { status: 400 });
  }

  const fileExtension = path.extname(uploadedEntry.name).toLowerCase().replace(".", "");
  const isAllowedType = fileExtension === "pdf" || uploadedEntry.type === "application/pdf";

  if (!isAllowedType) {
    return NextResponse.json({ error: "Only PDF documents are supported." }, { status: 400 });
  }

  const baseName = sanitizeFileBaseName(path.parse(uploadedEntry.name).name) || "scm-policy";
  const uniqueSuffix = randomUUID().slice(0, 8);
  const storageFileName = `${baseName}-${uniqueSuffix}.pdf`;

  try {
    const policyUrl = await storePublicUpload({
      blobPath: `system-policies/${storageFileName}`,
      file: uploadedEntry,
      localDirectory: policyRootDirectory,
      localFileName: storageFileName,
      localUrlPath: `/system-policies/${storageFileName}`,
    });
    const updatedPolicy = await updateSystemPolicySettings({
      policyUrl,
      fileName: uploadedEntry.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentProfile.displayName,
    });
    await deleteStoredPublicUpload({
      fileUrl: existingPolicy.policyUrl,
      localUrlPrefix: "/system-policies/",
      localRootDirectory: policyRootDirectory,
    });

    return NextResponse.json({
      ok: true,
      policy: updatedPolicy,
    });
  } catch (error) {
    if (error instanceof PublicUploadStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Could not upload SCM policy PDF", error);
    return NextResponse.json(
      { error: "Could not upload the SCM policy PDF right now." },
      { status: 500 },
    );
  }
}
