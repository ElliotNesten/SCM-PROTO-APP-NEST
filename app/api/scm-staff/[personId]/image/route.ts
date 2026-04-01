import { randomUUID } from "crypto";
import path from "path";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  getCurrentAuthenticatedScmStaffProfile,
  isSuperAdminRole,
} from "@/lib/auth-session";
import { deleteStoredPublicUpload, storePublicUpload } from "@/lib/public-file-storage";
import {
  getStoredScmStaffProfileById,
  updateStoredScmStaffImage,
} from "@/lib/scm-staff-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ personId: string }>;
};

const publicRootDirectory = path.join(process.cwd(), "public");
const imageRootDirectory = path.join(publicRootDirectory, "scm-staff-images");
const allowedExtensions = new Set(["png", "jpg", "jpeg", "webp"]);

function sanitizeFileBaseName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function deletePreviousImage(currentImageUrl: string | undefined) {
  await deleteStoredPublicUpload({
    fileUrl: currentImageUrl,
    localUrlPrefix: "/scm-staff-images/",
    localRootDirectory: imageRootDirectory,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { personId } = await context.params;
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();

  if (!currentProfile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSuperAdminRole(currentProfile.roleKey) && currentProfile.id !== personId) {
    return NextResponse.json(
      { error: "You can only update your own SCM Staff profile image." },
      { status: 403 },
    );
  }

  const profile = await getStoredScmStaffProfileById(personId);

  if (!profile) {
    return NextResponse.json({ error: "SCM staff profile not found." }, { status: 404 });
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

  const baseName =
    sanitizeFileBaseName(path.parse(uploadedEntry.name).name) || "scm-staff-profile";
  const uniqueSuffix = randomUUID().slice(0, 8);
  const normalizedExtension = fileExtension || "png";
  const storageFileName = `${baseName}-${uniqueSuffix}.${normalizedExtension}`;
  const personDirectory = path.join(imageRootDirectory, personId);
  const profileImageUrl = await storePublicUpload({
    blobPath: `scm-staff-images/${personId}/${storageFileName}`,
    file: uploadedEntry,
    localDirectory: personDirectory,
    localFileName: storageFileName,
    localUrlPath: `/scm-staff-images/${personId}/${storageFileName}`,
  });
  const updatedProfile = await updateStoredScmStaffImage(personId, {
    profileImageName: storageFileName,
    profileImageUrl,
  });

  if (!updatedProfile) {
    return NextResponse.json({ error: "SCM staff profile not found." }, { status: 404 });
  }

  await deletePreviousImage(profile.profileImageUrl);

  revalidatePath("/scm-staff");
  revalidatePath(`/scm-staff/${personId}`);
  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return NextResponse.json({
    ok: true,
    profileImageName: updatedProfile.profileImageName,
    profileImageUrl: updatedProfile.profileImageUrl,
  });
}
