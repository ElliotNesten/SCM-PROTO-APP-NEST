import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
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

async function deletePreviousPolicy(currentPolicyUrl: string | undefined) {
  if (!currentPolicyUrl || !currentPolicyUrl.startsWith("/system-policies/")) {
    return;
  }

  const relativeSegments = currentPolicyUrl.split("/").filter(Boolean);
  const filePath = path.join(publicRootDirectory, ...relativeSegments);
  const normalizedPath = path.normalize(filePath);
  const normalizedPublicRoot = path.normalize(publicRootDirectory);

  if (!normalizedPath.startsWith(normalizedPublicRoot)) {
    return;
  }

  try {
    await fs.unlink(normalizedPath);
  } catch (error) {
    const unlinkError = error as NodeJS.ErrnoException;
    if (unlinkError.code !== "ENOENT") {
      throw error;
    }
  }
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
  const outputPath = path.join(policyRootDirectory, storageFileName);

  await fs.mkdir(policyRootDirectory, { recursive: true });
  const fileBuffer = Buffer.from(await uploadedEntry.arrayBuffer());
  await fs.writeFile(outputPath, fileBuffer);

  const policyUrl = `/system-policies/${storageFileName}`;
  const updatedPolicy = await updateSystemPolicySettings({
    policyUrl,
    fileName: uploadedEntry.name,
    uploadedAt: new Date().toISOString(),
    uploadedBy: currentProfile.displayName,
  });
  await deletePreviousPolicy(existingPolicy.policyUrl);

  return NextResponse.json({
    ok: true,
    policy: updatedPolicy,
  });
}
