import fsp from "node:fs/promises";
import path from "node:path";

import {
  readSingletonSystemSetting,
  writeSingletonSystemSetting,
} from "@/lib/system-singleton-store";
import {
  defaultShiftPdfTemplates,
  normalizeShiftPdfTemplate,
  shiftPdfTemplateIds,
  type ShiftPdfTemplate,
  type ShiftPdfTemplateId,
} from "@/types/system-settings";

interface StoredSystemTemplateState {
  templates: Record<ShiftPdfTemplateId, ShiftPdfTemplate>;
}

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-template-store.json");
const systemSettingKey = "systemPdfTemplates";

function createDefaultSystemTemplateState(): StoredSystemTemplateState {
  return {
    templates: {
      employmentContract: normalizeShiftPdfTemplate(
        defaultShiftPdfTemplates.employmentContract,
      ),
      timeReport: normalizeShiftPdfTemplate(defaultShiftPdfTemplates.timeReport),
    },
  };
}

function normalizeStoredState(
  rawState: Partial<StoredSystemTemplateState> | null | undefined,
) {
  const defaultState = createDefaultSystemTemplateState();

  return {
    templates: {
      employmentContract: normalizeShiftPdfTemplate(
        rawState?.templates?.employmentContract ??
          defaultState.templates.employmentContract,
      ),
      timeReport: normalizeShiftPdfTemplate(
        rawState?.templates?.timeReport ?? defaultState.templates.timeReport,
      ),
    },
  } satisfies StoredSystemTemplateState;
}

async function readStoreSnapshot() {
  try {
    const raw = await fsp.readFile(storePath, "utf8");
    return normalizeStoredState(JSON.parse(raw) as StoredSystemTemplateState);
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === "ENOENT") {
      return createDefaultSystemTemplateState();
    }

    throw error;
  }
}

async function writeStore(state: StoredSystemTemplateState) {
  await fsp.mkdir(storeDirectory, { recursive: true });
  await fsp.writeFile(storePath, JSON.stringify(state, null, 2), "utf8");
}

export async function getSystemPdfTemplates() {
  return readSingletonSystemSetting({
    settingKey: systemSettingKey,
    normalize: normalizeStoredState,
    readFallback: readStoreSnapshot,
  });
}

export async function getSystemPdfTemplate(templateId: ShiftPdfTemplateId) {
  const state = await getSystemPdfTemplates();
  return state.templates[templateId];
}

export async function updateSystemPdfTemplate(
  templateId: ShiftPdfTemplateId,
  nextTemplate: ShiftPdfTemplate,
) {
  const state = await getSystemPdfTemplates();
  const normalizedTemplate = normalizeShiftPdfTemplate({
    ...nextTemplate,
    id: templateId,
  });
  const nextState: StoredSystemTemplateState = {
    templates: {
      ...state.templates,
      [templateId]: normalizedTemplate,
    },
  };

  const savedState = await writeSingletonSystemSetting({
    settingKey: systemSettingKey,
    value: nextState,
    normalize: normalizeStoredState,
    writeFallback: writeStore,
  });

  return savedState.templates[templateId];
}

export function isShiftPdfTemplateId(value: string): value is ShiftPdfTemplateId {
  return shiftPdfTemplateIds.includes(value as ShiftPdfTemplateId);
}
