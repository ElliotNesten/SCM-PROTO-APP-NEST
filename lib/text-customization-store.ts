import { promises as fs } from "fs";
import path from "path";

import {
  readSingletonSystemSetting,
  writeSingletonSystemSetting,
} from "@/lib/system-singleton-store";
import {
  normalizeTextCustomizationKey,
  normalizeTextCustomizationValue,
} from "@/lib/text-customization-shared";

export interface TextCustomizationState {
  overrides: Record<string, string>;
  updatedAt: string | null;
}

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "text-customization-store.json");
const systemSettingKey = "textCustomization";

const defaultTextCustomizationState: TextCustomizationState = {
  overrides: {},
  updatedAt: null,
};

function normalizeOverrideEntries(
  overrides: Record<string, string> | null | undefined,
): Record<string, string> {
  if (!overrides) {
    return {};
  }

  return Object.entries(overrides).reduce<Record<string, string>>(
    (nextOverrides, [rawKey, rawValue]) => {
      const key = normalizeTextCustomizationKey(rawKey);

      if (!key || typeof rawValue !== "string") {
        return nextOverrides;
      }

      const value = normalizeTextCustomizationValue(rawValue);

      if (value === key) {
        return nextOverrides;
      }

      nextOverrides[key] = value;
      return nextOverrides;
    },
    {},
  );
}

function normalizeTextCustomizationState(
  parsed: Partial<TextCustomizationState> | null | undefined,
): TextCustomizationState {
  return {
    overrides: normalizeOverrideEntries(parsed?.overrides),
    updatedAt:
      typeof parsed?.updatedAt === "string" && parsed.updatedAt.trim()
        ? parsed.updatedAt
        : null,
  };
}

async function readTextCustomizationStoreSnapshot(): Promise<TextCustomizationState> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return normalizeTextCustomizationState(JSON.parse(raw) as Partial<TextCustomizationState>);
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === "ENOENT") {
      return defaultTextCustomizationState;
    }

    throw error;
  }
}

async function writeTextCustomizationStore(state: TextCustomizationState) {
  await fs.mkdir(storeDirectory, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(state, null, 2), "utf8");
}

export async function getTextCustomizationState() {
  return readSingletonSystemSetting({
    settingKey: systemSettingKey,
    normalize: normalizeTextCustomizationState,
    readFallback: readTextCustomizationStoreSnapshot,
  });
}

export async function updateTextCustomizationOverrides(
  nextOverrides: Record<string, string>,
) {
  const state: TextCustomizationState = {
    overrides: normalizeOverrideEntries(nextOverrides),
    updatedAt: new Date().toISOString(),
  };

  return writeSingletonSystemSetting({
    settingKey: systemSettingKey,
    value: state,
    normalize: normalizeTextCustomizationState,
    writeFallback: writeTextCustomizationStore,
  });
}
