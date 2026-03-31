import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getStoredGigById, updateStoredGigImage } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ gigId: string }>;
};

const publicRootDirectory = path.join(process.cwd(), "public");
const imageRootDirectory = path.join(publicRootDirectory, "gig-images");
const allowedExtensions = new Set(["png", "jpg", "jpeg", "webp"]);

function sanitizeFileBaseName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function deletePreviousImage(currentImageUrl: string | undefined) {
  if (!currentImageUrl || !currentImageUrl.startsWith("/gig-images/")) {
    return;
  }

  const relativeSegments = currentImageUrl.split("/").filter(Boolean);
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

export async function POST(request: Request, context: RouteContext) {
  const { gigId } = await context.params;
  const gig = await getStoredGigById(gigId);

  if (!gig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessPlatformGig(currentProfile, gig)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

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
    uploadedEntry.type === "image/webp";

  if (!isAllowedType) {
    return NextResponse.json(
      { error: "Only PNG, JPG, JPEG, and WEBP images are supported." },
      { status: 400 },
    );
  }

  const baseName = sanitizeFileBaseName(path.parse(uploadedEntry.name).name) || "gig-image";
  const uniqueSuffix = randomUUID().slice(0, 8);
  const normalizedExtension = fileExtension || "png";
  const storageFileName = `${baseName}-${uniqueSuffix}.${normalizedExtension}`;
  const gigDirectory = path.join(imageRootDirectory, gigId);
  const outputPath = path.join(gigDirectory, storageFileName);

  await fs.mkdir(gigDirectory, { recursive: true });
  const fileBuffer = Buffer.from(await uploadedEntry.arrayBuffer());
  await fs.writeFile(outputPath, fileBuffer);

  const profileImageUrl = `/gig-images/${gigId}/${storageFileName}`;
  const updatedGig = await updateStoredGigImage(gigId, profileImageUrl);

  if (!updatedGig) {
    return NextResponse.json({ error: "Gig not found." }, { status: 404 });
  }

  await deletePreviousImage(gig.profileImageUrl);

  return NextResponse.json({
    ok: true,
    profileImageUrl,
  });
}
