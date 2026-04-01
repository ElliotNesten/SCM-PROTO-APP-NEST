import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

import {
  createStoredStaffApplication,
  getActiveStoredStaffApplicationByEmail,
} from "@/lib/staff-application-store";
import { getStoredStaffProfileByEmail } from "@/lib/staff-store";
import {
  staffApplicationCountryOptions,
  swedenStaffApplicationRegionOptions,
} from "@/types/job-applications";

export const runtime = "nodejs";

const publicRootDirectory = path.join(process.cwd(), "public");
const imageRootDirectory = path.join(publicRootDirectory, "application-images");
const allowedExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
const maxFileSize = 5 * 1024 * 1024;

function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function sanitizeFileBaseName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function isAllowedCountry(value: string) {
  return staffApplicationCountryOptions.includes(
    value as (typeof staffApplicationCountryOptions)[number],
  );
}

function isAllowedSwedenRegion(value: string) {
  return swedenStaffApplicationRegionOptions.includes(
    value as (typeof swedenStaffApplicationRegionOptions)[number],
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const profileImage = formData.get("profileImage");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();

  if (!(profileImage instanceof File) || profileImage.size === 0) {
    return NextResponse.json({ error: "Profile image is required." }, { status: 400 });
  }

  if (!displayName || !email || !phone || !country || !region) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  if (!isAllowedCountry(country)) {
    return NextResponse.json({ error: "Choose a valid country." }, { status: 400 });
  }

  if (country === "Sweden" && !isAllowedSwedenRegion(region)) {
    return NextResponse.json({ error: "Choose a valid Swedish region." }, { status: 400 });
  }

  if (profileImage.size > maxFileSize) {
    return NextResponse.json(
      { error: "Profile image must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  const fileExtension = path.extname(profileImage.name).toLowerCase().replace(".", "");
  const isAllowedType =
    allowedExtensions.has(fileExtension) ||
    profileImage.type === "image/png" ||
    profileImage.type === "image/jpeg" ||
    profileImage.type === "image/webp";

  if (!isAllowedType) {
    return NextResponse.json(
      { error: "Only PNG, JPG, JPEG, and WEBP images are supported." },
      { status: 400 },
    );
  }

  const [existingStaffProfile, existingApplication] = await Promise.all([
    getStoredStaffProfileByEmail(email),
    getActiveStoredStaffApplicationByEmail(email),
  ]);

  if (existingStaffProfile) {
    return NextResponse.json(
      { error: "An employee profile with this email already exists." },
      { status: 409 },
    );
  }

  if (existingApplication) {
    return NextResponse.json(
      { error: "An active application with this email already exists." },
      { status: 409 },
    );
  }

  const applicationId = `application-${randomUUID().slice(0, 8)}`;
  const baseName =
    sanitizeFileBaseName(path.parse(profileImage.name).name) || "work-at-scm-profile";
  const normalizedExtension = fileExtension || "png";
  const storageFileName = `${baseName}-${randomUUID().slice(0, 8)}.${normalizedExtension}`;
  let profileImageUrl = `/application-images/${applicationId}/${storageFileName}`;

  if (isBlobConfigured()) {
    const blob = await put(
      `staff-applications/${applicationId}/${storageFileName}`,
      profileImage,
      {
        access: "public",
        addRandomSuffix: false,
      },
    );
    profileImageUrl = blob.url;
  } else {
    const applicationDirectory = path.join(imageRootDirectory, applicationId);
    const outputPath = path.join(applicationDirectory, storageFileName);

    await fs.mkdir(applicationDirectory, { recursive: true });
    await fs.writeFile(outputPath, Buffer.from(await profileImage.arrayBuffer()));
  }

  const application = await createStoredStaffApplication({
    id: applicationId,
    profileImageName: storageFileName,
    profileImageUrl,
    displayName,
    email,
    phone,
    country,
    region,
  });

  return NextResponse.json({
    ok: true,
    applicationId: application.id,
  });
}
