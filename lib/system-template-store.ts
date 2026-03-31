import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

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

function writeStoreSync(state: StoredSystemTemplateState) {
  fs.mkdirSync(storeDirectory, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(state, null, 2), "utf8");
}

function ensureStoreSync() {
  if (!fs.existsSync(storePath)) {
    writeStoreSync(createDefaultSystemTemplateState());
  }
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

async function ensureStore() {
  try {
    await fsp.access(storePath);
  } catch {
    await fsp.mkdir(storeDirectory, { recursive: true });
    await fsp.writeFile(
      storePath,
      JSON.stringify(createDefaultSystemTemplateState(), null, 2),
      "utf8",
    );
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fsp.readFile(storePath, "utf8");
  return normalizeStoredState(JSON.parse(raw) as StoredSystemTemplateState);
}

export function getSystemPdfTemplatesSync() {
  ensureStoreSync();
  const raw = fs.readFileSync(storePath, "utf8");
  return normalizeStoredState(JSON.parse(raw) as StoredSystemTemplateState);
}

export function getSystemPdfTemplateSync(templateId: ShiftPdfTemplateId) {
  return getSystemPdfTemplatesSync().templates[templateId];
}

export async function getSystemPdfTemplates() {
  return await readStore();
}

export async function getSystemPdfTemplate(templateId: ShiftPdfTemplateId) {
  const state = await readStore();
  return state.templates[templateId];
}

export async function updateSystemPdfTemplate(
  templateId: ShiftPdfTemplateId,
  nextTemplate: ShiftPdfTemplate,
) {
  const state = await readStore();
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

  await fsp.writeFile(storePath, JSON.stringify(nextState, null, 2), "utf8");

  return nextState.templates[templateId];
}

export function isShiftPdfTemplateId(value: string): value is ShiftPdfTemplateId {
  return shiftPdfTemplateIds.includes(value as ShiftPdfTemplateId);
}
