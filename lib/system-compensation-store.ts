import { promises as fs } from "node:fs";
import path from "node:path";

import { normalizeCompensationRateMatrix } from "@/lib/compensation";
import {
  readSingletonSystemSetting,
  writeSingletonSystemSetting,
} from "@/lib/system-singleton-store";
import {
  createDefaultCompensationRateMatrix,
  type SystemCompensationSettings,
} from "@/types/compensation";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-compensation-store.json");
const systemSettingKey = "systemCompensation";

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

async function readSystemCompensationStoreSnapshot() {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return normalizeSystemCompensationSettings(
      JSON.parse(raw) as Partial<SystemCompensationSettings>,
    );
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === "ENOENT") {
      return createDefaultSystemCompensationSettings();
    }

    throw error;
  }
}

async function writeSystemCompensationStore(
  settings: SystemCompensationSettings,
) {
  await fs.mkdir(storeDirectory, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(settings, null, 2), "utf8");
}

export async function getSystemCompensationSettings() {
  return readSingletonSystemSetting({
    settingKey: systemSettingKey,
    normalize: normalizeSystemCompensationSettings,
    readFallback: readSystemCompensationStoreSnapshot,
  });
}

export async function updateSystemCompensationSettings(
  updates: Partial<SystemCompensationSettings>,
) {
  const currentSettings = await getSystemCompensationSettings();
  const nextSettings = {
    ...currentSettings,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return writeSingletonSystemSetting({
    settingKey: systemSettingKey,
    value: nextSettings,
    normalize: normalizeSystemCompensationSettings,
    writeFallback: writeSystemCompensationStore,
  });
}
