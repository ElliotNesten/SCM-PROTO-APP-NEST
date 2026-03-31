import { promises as fs } from "node:fs";
import path from "node:path";

import { normalizeCompensationRateMatrix } from "@/lib/compensation";
import {
  createDefaultCompensationRateMatrix,
  type SystemCompensationSettings,
} from "@/types/compensation";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-compensation-store.json");

function createDefaultSystemCompensationSettings(): SystemCompensationSettings {
  return {
    defaultHourlyRates: createDefaultCompensationRateMatrix(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSystemCompensationSettings(
  settings: Partial<SystemCompensationSettings> | null | undefined,
) {
  const fallbackSettings = createDefaultSystemCompensationSettings();

  return {
    defaultHourlyRates: normalizeCompensationRateMatrix(
      settings?.defaultHourlyRates,
    ),
    updatedAt:
      typeof settings?.updatedAt === "string" && settings.updatedAt.trim().length > 0
        ? settings.updatedAt
        : fallbackSettings.updatedAt,
  } satisfies SystemCompensationSettings;
}

async function ensureSystemCompensationStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify(createDefaultSystemCompensationSettings(), null, 2),
      "utf8",
    );
  }
}

async function readSystemCompensationStore() {
  await ensureSystemCompensationStore();
  const raw = await fs.readFile(storePath, "utf8");
  return normalizeSystemCompensationSettings(
    JSON.parse(raw) as Partial<SystemCompensationSettings>,
  );
}

async function writeSystemCompensationStore(
  settings: SystemCompensationSettings,
) {
  await fs.writeFile(storePath, JSON.stringify(settings, null, 2), "utf8");
}

export async function getSystemCompensationSettings() {
  return readSystemCompensationStore();
}

export async function updateSystemCompensationSettings(
  updates: Partial<SystemCompensationSettings>,
) {
  const currentSettings = await readSystemCompensationStore();
  const nextSettings = normalizeSystemCompensationSettings({
    ...currentSettings,
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  await writeSystemCompensationStore(nextSettings);
  return nextSettings;
}
