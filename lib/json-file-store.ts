import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type JsonFileCacheEntry = {
  mtimeMs: number;
  size: number;
  value: unknown;
};

const globalForJsonFileStore = globalThis as typeof globalThis & {
  __scmJsonFileCache?: Map<string, JsonFileCacheEntry>;
};

function stripUtf8Bom(raw: string) {
  return raw.replace(/^\uFEFF/, "");
}

function getJsonFileCache() {
  if (!globalForJsonFileStore.__scmJsonFileCache) {
    globalForJsonFileStore.__scmJsonFileCache = new Map<string, JsonFileCacheEntry>();
  }

  return globalForJsonFileStore.__scmJsonFileCache;
}

function cloneJsonValue<T>(value: T): T {
  return structuredClone(value);
}

function updateJsonFileCache(filePath: string, stat: { mtimeMs: number; size: number }, value: unknown) {
  getJsonFileCache().set(filePath, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    value: cloneJsonValue(value),
  });
}

export function invalidateJsonFileCache(filePath: string) {
  getJsonFileCache().delete(filePath);
}

export async function ensureJsonFile<T>(filePath: string, seedValue: T) {
  try {
    await fs.access(filePath);
  } catch {
    await writeJsonFile(filePath, seedValue);
  }
}

export async function readJsonFile<T>(filePath: string, fallbackValue: T) {
  const fileStat = await fs.stat(filePath);
  const cachedValue = getJsonFileCache().get(filePath);

  if (
    cachedValue &&
    cachedValue.mtimeMs === fileStat.mtimeMs &&
    cachedValue.size === fileStat.size
  ) {
    return cloneJsonValue(cachedValue.value as T);
  }

  const raw = stripUtf8Bom(await fs.readFile(filePath, "utf8"));

  if (!raw.trim()) {
    updateJsonFileCache(filePath, fileStat, fallbackValue);
    return fallbackValue;
  }

  const parsedValue = JSON.parse(raw) as T;
  updateJsonFileCache(filePath, fileStat, parsedValue);
  return cloneJsonValue(parsedValue);
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;

  await fs.writeFile(tempPath, serialized, "utf8");

  try {
    await fs.rename(tempPath, filePath);
  } catch {
    await fs.rm(filePath, { force: true });
    await fs.rename(tempPath, filePath);
  }

  const fileStat = await fs.stat(filePath);
  updateJsonFileCache(filePath, fileStat, value);
}
