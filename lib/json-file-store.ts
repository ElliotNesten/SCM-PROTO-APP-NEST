import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function stripUtf8Bom(raw: string) {
  return raw.replace(/^\uFEFF/, "");
}

export async function ensureJsonFile<T>(filePath: string, seedValue: T) {
  try {
    await fs.access(filePath);
  } catch {
    await writeJsonFile(filePath, seedValue);
  }
}

export async function readJsonFile<T>(filePath: string, fallbackValue: T) {
  const raw = stripUtf8Bom(await fs.readFile(filePath, "utf8"));

  if (!raw.trim()) {
    return fallbackValue;
  }

  return JSON.parse(raw) as T;
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
}
