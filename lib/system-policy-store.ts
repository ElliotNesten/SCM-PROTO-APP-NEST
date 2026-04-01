import { promises as fs } from "node:fs";
import path from "node:path";

import {
  readSingletonSystemSetting,
  writeSingletonSystemSetting,
} from "@/lib/system-singleton-store";

export interface SystemPolicySettings {
  policyUrl: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
}

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-policy-store.json");
const systemSettingKey = "systemPolicy";
const defaultSystemPolicySettings: SystemPolicySettings = {
  policyUrl: "",
  fileName: "",
  uploadedAt: "",
  uploadedBy: "",
};

function normalizeSystemPolicySettings(
  parsed: Partial<SystemPolicySettings> | null | undefined,
): SystemPolicySettings {
  return {
    policyUrl: parsed?.policyUrl?.trim() || "",
    fileName: parsed?.fileName?.trim() || "",
    uploadedAt: parsed?.uploadedAt?.trim() || "",
    uploadedBy: parsed?.uploadedBy?.trim() || "",
  };
}

async function readSystemPolicyStoreSnapshot(): Promise<SystemPolicySettings> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return normalizeSystemPolicySettings(JSON.parse(raw) as Partial<SystemPolicySettings>);
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === "ENOENT") {
      return defaultSystemPolicySettings;
    }

    throw error;
  }
}

async function writeSystemPolicyStore(settings: SystemPolicySettings) {
  await fs.mkdir(storeDirectory, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(settings, null, 2), "utf8");
}

export async function getSystemPolicySettings() {
  return readSingletonSystemSetting({
    settingKey: systemSettingKey,
    normalize: normalizeSystemPolicySettings,
    readFallback: readSystemPolicyStoreSnapshot,
  });
}

export async function updateSystemPolicySettings(settings: Partial<SystemPolicySettings>) {
  const currentSettings = await getSystemPolicySettings();
  const nextSettings: SystemPolicySettings = {
    policyUrl: settings.policyUrl?.trim() || "",
    fileName: settings.fileName?.trim() || "",
    uploadedAt: settings.uploadedAt?.trim() || currentSettings.uploadedAt || "",
    uploadedBy: settings.uploadedBy?.trim() || currentSettings.uploadedBy || "",
  };

  return writeSingletonSystemSetting({
    settingKey: systemSettingKey,
    value: nextSettings,
    normalize: normalizeSystemPolicySettings,
    writeFallback: writeSystemPolicyStore,
  });
}
