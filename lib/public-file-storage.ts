import { promises as fs } from "node:fs";
import path from "node:path";

import { del, put } from "@vercel/blob";

type StorePublicUploadOptions = {
  blobPath: string;
  file: File;
  localDirectory: string;
  localFileName: string;
  localUrlPath: string;
};

type DeleteStoredPublicUploadOptions = {
  fileUrl: string | undefined;
  localUrlPrefix: string;
  localRootDirectory: string;
};

export type PublicUploadStorageStatus = {
  available: boolean;
  mode: "blob" | "local" | "unavailable";
  message: string;
};

export class PublicUploadStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicUploadStorageError";
  }
}

export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function isVercelHostedRuntime() {
  return Boolean(process.env.VERCEL?.trim());
}

export function getPublicUploadStorageStatus(): PublicUploadStorageStatus {
  if (isBlobConfigured()) {
    return {
      available: true,
      mode: "blob",
      message: "",
    };
  }

  if (!isVercelHostedRuntime()) {
    return {
      available: true,
      mode: "local",
      message: "",
    };
  }

  return {
    available: false,
    mode: "unavailable",
    message:
      "Uploads are disabled in this Vercel deployment because BLOB_READ_WRITE_TOKEN is missing. Add Vercel Blob storage to enable file uploads.",
  };
}

function isBlobUrl(fileUrl: string) {
  try {
    const parsedUrl = new URL(fileUrl);
    return parsedUrl.hostname.includes("blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function storePublicUpload({
  blobPath,
  file,
  localDirectory,
  localFileName,
  localUrlPath,
}: StorePublicUploadOptions) {
  const storageStatus = getPublicUploadStorageStatus();

  if (!storageStatus.available) {
    throw new PublicUploadStorageError(storageStatus.message);
  }

  if (storageStatus.mode === "blob") {
    const blob = await put(blobPath, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return blob.url;
  }

  await fs.mkdir(localDirectory, { recursive: true });
  await fs.writeFile(
    path.join(localDirectory, localFileName),
    Buffer.from(await file.arrayBuffer()),
  );

  return localUrlPath;
}

export async function deleteStoredPublicUpload({
  fileUrl,
  localUrlPrefix,
  localRootDirectory,
}: DeleteStoredPublicUploadOptions) {
  if (!fileUrl) {
    return;
  }

  if (isBlobUrl(fileUrl)) {
    if (!isBlobConfigured()) {
      return;
    }

    await del(fileUrl).catch(() => undefined);
    return;
  }

  if (!fileUrl.startsWith(localUrlPrefix)) {
    return;
  }

  const relativeSegments = fileUrl.split("/").filter(Boolean);
  const filePath = path.join(localRootDirectory, ...relativeSegments.slice(1));
  const normalizedPath = path.normalize(filePath);
  const normalizedRoot = path.normalize(localRootDirectory);

  if (!normalizedPath.startsWith(normalizedRoot)) {
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
