import { randomUUID } from "crypto";
import path from "path";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deleteStoredPublicUpload, storePublicUpload } from "@/lib/public-file-storage";
import { syncStaffAppAccountFromLinkedStaffProfile } from "@/lib/staff-app-store";
import {
  getStoredStaffProfileById,
  updateStoredStaffImage,
} from "@/lib/staff-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ personId: string }>;
};

const publicRootDirectory = path.join(process.cwd(), "public");
const imageRootDirectory = path.join(publicRootDirectory, "staff-images");
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
    localUrlPrefix: "/staff-images/",
    localRootDirectory: imageRootDirectory,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { personId } = await context.params;
  const profile = await getStoredStaffProfileById(personId);

  if (!profile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
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
    sanitizeFileBaseName(path.parse(uploadedEntry.name).name) || "staff-profile";
  const uniqueSuffix = randomUUID().slice(0, 8);
  const normalizedExtension = fileExtension || "png";
  const storageFileName = `${baseName}-${uniqueSuffix}.${normalizedExtension}`;
  const personDirectory = path.join(imageRootDirectory, personId);
  const profileImageUrl = await storePublicUpload({
    blobPath: `staff-images/${personId}/${storageFileName}`,
    file: uploadedEntry,
    localDirectory: personDirectory,
    localFileName: storageFileName,
    localUrlPath: `/staff-images/${personId}/${storageFileName}`,
  });
  const updatedProfile = await updateStoredStaffImage(personId, {
    profileImageName: storageFileName,
    profileImageUrl,
  });

  if (!updatedProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
  }

  await syncStaffAppAccountFromLinkedStaffProfile({
    id: updatedProfile.id,
    displayName: updatedProfile.displayName,
    email: updatedProfile.email,
    phone: updatedProfile.phone,
    country: updatedProfile.country,
    region: updatedProfile.region,
    roleProfiles: updatedProfile.roleProfiles,
    roles: updatedProfile.roles,
    priority: updatedProfile.priority,
    profileImageUrl: updatedProfile.profileImageUrl,
  });

  await deletePreviousImage(profile.profileImageUrl);
  revalidatePath("/people");
  revalidatePath(`/people/${personId}`);

  return NextResponse.json({
    ok: true,
    profileImageName: updatedProfile.profileImageName,
    profileImageUrl: updatedProfile.profileImageUrl,
  });
}
