import { promises as fs } from "fs";
import path from "path";

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

async function ensureTextCustomizationStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify(defaultTextCustomizationState, null, 2),
      "utf8",
    );
  }
}

async function readTextCustomizationStore(): Promise<TextCustomizationState> {
  await ensureTextCustomizationStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<TextCustomizationState>;

  return {
    overrides: normalizeOverrideEntries(parsed.overrides),
    updatedAt:
      typeof parsed.updatedAt === "string" && parsed.updatedAt.trim()
        ? parsed.updatedAt
        : null,
  };
}

async function writeTextCustomizationStore(state: TextCustomizationState) {
  await fs.writeFile(storePath, JSON.stringify(state, null, 2), "utf8");
}

export async function getTextCustomizationState() {
  return readTextCustomizationStore();
}

export async function updateTextCustomizationOverrides(
  nextOverrides: Record<string, string>,
) {
  const state: TextCustomizationState = {
    overrides: normalizeOverrideEntries(nextOverrides),
    updatedAt: new Date().toISOString(),
  };

  await writeTextCustomizationStore(state);
  return state;
}
