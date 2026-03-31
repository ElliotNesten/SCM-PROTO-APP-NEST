import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import { getBrandSettings, updateBrandLogo } from "@/lib/brand-store";

export const runtime = "nodejs";

const publicRootDirectory = path.join(process.cwd(), "public");
const imageRootDirectory = path.join(publicRootDirectory, "brand", "uploads");
const allowedExtensions = new Set(["png", "jpg", "jpeg", "webp", "svg"]);

function sanitizeFileBaseName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function deletePreviousLogo(currentLogoUrl: string | undefined) {
  if (!currentLogoUrl || !currentLogoUrl.startsWith("/brand/uploads/")) {
    return;
  }

  const relativeSegments = currentLogoUrl.split("/").filter(Boolean);
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

export async function POST(request: Request) {
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Sign in to update the logo." }, { status: 401 });
  }

  if (!isSuperAdminRole(currentProfile.roleKey)) {
    return NextResponse.json(
      { error: "Only Super Admin can update the header logo." },
      { status: 403 },
    );
  }

  const brandSettings = await getBrandSettings();
  const formData = await request.formData();
  const uploadedEntry = formData.get("image");

  if (!(uploadedEntry instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  const fileExtension = path.extname(uploadedEntry.name).toLowerCase().replace(".", "");
  const isAllowedType =
    allowedExtensions.has(fileExtension) ||
    uploadedEntry.type === "image/png" ||
    uploadedEntry.type === "image/jpeg" ||
    uploadedEntry.type === "image/webp" ||
    uploadedEntry.type === "image/svg+xml";

  if (!isAllowedType) {
    return NextResponse.json(
      { error: "Only PNG, JPG, JPEG, WEBP, and SVG images are supported." },
      { status: 400 },
    );
  }

  const baseName = sanitizeFileBaseName(path.parse(uploadedEntry.name).name) || "brand-logo";
  const uniqueSuffix = randomUUID().slice(0, 8);
  const normalizedExtension = fileExtension || (uploadedEntry.type === "image/svg+xml" ? "svg" : "png");
  const storageFileName = `${baseName}-${uniqueSuffix}.${normalizedExtension}`;
  const outputPath = path.join(imageRootDirectory, storageFileName);

  await fs.mkdir(imageRootDirectory, { recursive: true });
  const fileBuffer = Buffer.from(await uploadedEntry.arrayBuffer());
  await fs.writeFile(outputPath, fileBuffer);

  const logoUrl = `/brand/uploads/${storageFileName}`;
  await updateBrandLogo(logoUrl);
  await deletePreviousLogo(brandSettings.logoUrl);

  return NextResponse.json({
    ok: true,
    logoUrl,
  });
}
