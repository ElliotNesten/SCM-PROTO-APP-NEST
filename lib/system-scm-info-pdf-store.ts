import { promises as fs } from "node:fs";
import path from "node:path";

import type { StaffAppScmInfoSectionKey } from "@/lib/system-scm-info-store";
import {
  readSingletonSystemSetting,
  writeSingletonSystemSetting,
} from "@/lib/system-singleton-store";
import {
  createEmptyStaffAppScmInfoPdfAsset,
  createEmptyStaffAppScmInfoPdfSlots,
  STAFF_APP_SCM_INFO_PDF_LIMIT,
  getSystemScmInfoItemPdfKey,
  staffAppScmInfoItemPdfSectionKeys,
  staffAppScmInfoPdfSectionKeys,
} from "@/lib/system-scm-info-pdf-shared";
import type {
  StaffAppScmInfoItemPdfSectionKey,
  StaffAppScmInfoPdfAsset,
  SystemScmInfoPdfSettings,
} from "@/lib/system-scm-info-pdf-shared";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-scm-info-pdf-store.json");
const systemSettingKey = "systemScmInfoPdfs";

function createDefaultSystemScmInfoPdfSettings(): SystemScmInfoPdfSettings {
  return {
    sectionPdfs: {
      rolesTraining: createEmptyStaffAppScmInfoPdfSlots(),
      checklists: createEmptyStaffAppScmInfoPdfSlots(),
      platformInfo: createEmptyStaffAppScmInfoPdfSlots(),
      policy: createEmptyStaffAppScmInfoPdfSlots(),
      cashCard: createEmptyStaffAppScmInfoPdfSlots(),
      arenaInfo: createEmptyStaffAppScmInfoPdfSlots(),
    },
    itemPdfs: {},
  };
}

function normalizePdfAsset(
  rawAsset: Partial<StaffAppScmInfoPdfAsset> | null | undefined,
): StaffAppScmInfoPdfAsset {
  return {
    pdfUrl: rawAsset?.pdfUrl?.trim() || "",
    fileName: rawAsset?.fileName?.trim() || "",
    uploadedAt: rawAsset?.uploadedAt?.trim() || "",
    uploadedBy: rawAsset?.uploadedBy?.trim() || "",
    buttonLabel: rawAsset?.buttonLabel?.trim() || "",
  };
}

function normalizePdfAssetSlots(
  rawValue:
    | Partial<StaffAppScmInfoPdfAsset>
    | Array<Partial<StaffAppScmInfoPdfAsset> | null | undefined>
    | null
    | undefined,
) {
  if (Array.isArray(rawValue)) {
    const normalizedSlots = rawValue
      .slice(0, STAFF_APP_SCM_INFO_PDF_LIMIT)
      .map((asset) => normalizePdfAsset(asset));

    while (normalizedSlots.length < STAFF_APP_SCM_INFO_PDF_LIMIT) {
      normalizedSlots.push(createEmptyStaffAppScmInfoPdfAsset());
    }

    return normalizedSlots;
  }

  const singleAsset = normalizePdfAsset(rawValue);
  const emptySlots = createEmptyStaffAppScmInfoPdfSlots();
  emptySlots[0] = singleAsset;
  return emptySlots;
}

function normalizeSystemScmInfoPdfSettings(
  rawSettings: Partial<SystemScmInfoPdfSettings> | null | undefined,
): SystemScmInfoPdfSettings {
  return {
    sectionPdfs: {
      rolesTraining: normalizePdfAssetSlots(rawSettings?.sectionPdfs?.rolesTraining),
      checklists: normalizePdfAssetSlots(rawSettings?.sectionPdfs?.checklists),
      platformInfo: normalizePdfAssetSlots(rawSettings?.sectionPdfs?.platformInfo),
      policy: normalizePdfAssetSlots(rawSettings?.sectionPdfs?.policy),
      cashCard: normalizePdfAssetSlots(rawSettings?.sectionPdfs?.cashCard),
      arenaInfo: normalizePdfAssetSlots(rawSettings?.sectionPdfs?.arenaInfo),
    },
    itemPdfs: Object.fromEntries(
      Object.entries(rawSettings?.itemPdfs ?? {}).map(([key, asset]) => [
        key,
        normalizePdfAssetSlots(asset),
      ]),
    ),
  } satisfies SystemScmInfoPdfSettings;
}

async function readSystemScmInfoPdfStoreSnapshot() {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return normalizeSystemScmInfoPdfSettings(
      JSON.parse(raw) as Partial<SystemScmInfoPdfSettings>,
    );
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === "ENOENT") {
      return createDefaultSystemScmInfoPdfSettings();
    }

    throw error;
  }
}

async function writeSystemScmInfoPdfStore(settings: SystemScmInfoPdfSettings) {
  await fs.mkdir(storeDirectory, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(settings, null, 2), "utf8");
}

export function isStaffAppScmInfoSectionKey(value: string): value is StaffAppScmInfoSectionKey {
  return staffAppScmInfoPdfSectionKeys.includes(value as StaffAppScmInfoSectionKey);
}

export function isStaffAppScmInfoItemPdfSectionKey(
  value: string,
): value is StaffAppScmInfoItemPdfSectionKey {
  return staffAppScmInfoItemPdfSectionKeys.includes(value as StaffAppScmInfoItemPdfSectionKey);
}

export async function getSystemScmInfoPdfSettings() {
  return readSingletonSystemSetting({
    settingKey: systemSettingKey,
    normalize: normalizeSystemScmInfoPdfSettings,
    readFallback: readSystemScmInfoPdfStoreSnapshot,
  });
}

async function persistSystemScmInfoPdfSettings(settings: SystemScmInfoPdfSettings) {
  return writeSingletonSystemSetting({
    settingKey: systemSettingKey,
    value: settings,
    normalize: normalizeSystemScmInfoPdfSettings,
    writeFallback: writeSystemScmInfoPdfStore,
  });
}

export async function updateSystemScmInfoSectionPdf(
  sectionId: StaffAppScmInfoSectionKey,
  slotIndex: number,
  asset: Partial<StaffAppScmInfoPdfAsset>,
) {
  const currentSettings = await getSystemScmInfoPdfSettings();
  const currentSlots = normalizePdfAssetSlots(currentSettings.sectionPdfs[sectionId]);
  const nextSlots = currentSlots.map((currentAsset, currentIndex) =>
    currentIndex === slotIndex ? normalizePdfAsset(asset) : currentAsset,
  );
  const nextSettings: SystemScmInfoPdfSettings = {
    ...currentSettings,
    sectionPdfs: {
      ...currentSettings.sectionPdfs,
      [sectionId]: nextSlots,
    },
  };

  return persistSystemScmInfoPdfSettings(nextSettings);
}

export async function updateSystemScmInfoItemPdf(
  sectionId: StaffAppScmInfoItemPdfSectionKey,
  itemIndex: number,
  slotIndex: number,
  asset: Partial<StaffAppScmInfoPdfAsset>,
) {
  const currentSettings = await getSystemScmInfoPdfSettings();
  const itemKey = getSystemScmInfoItemPdfKey(sectionId, itemIndex);
  const currentSlots = normalizePdfAssetSlots(currentSettings.itemPdfs[itemKey]);
  const nextSlots = currentSlots.map((currentAsset, currentIndex) =>
    currentIndex === slotIndex ? normalizePdfAsset(asset) : currentAsset,
  );
  const nextSettings: SystemScmInfoPdfSettings = {
    ...currentSettings,
    itemPdfs: {
      ...currentSettings.itemPdfs,
      [itemKey]: nextSlots,
    },
  };

  return persistSystemScmInfoPdfSettings(nextSettings);
}

export async function updateSystemScmInfoPdfSettings(
  settings: Partial<SystemScmInfoPdfSettings>,
) {
  return persistSystemScmInfoPdfSettings(
    normalizeSystemScmInfoPdfSettings(settings),
  );
}

export function getEmptySystemScmInfoPdfAsset() {
  return createEmptyStaffAppScmInfoPdfAsset();
}
