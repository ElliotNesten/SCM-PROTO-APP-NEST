import type { StaffAppScmInfoSectionKey } from "@/lib/system-scm-info-store";

export type StaffAppScmInfoItemPdfSectionKey =
  | "rolesTraining"
  | "checklists"
  | "platformInfo"
  | "cashCard";

export interface StaffAppScmInfoPdfAsset {
  pdfUrl: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  buttonLabel: string;
}

export interface SystemScmInfoPdfSettings {
  sectionPdfs: Record<StaffAppScmInfoSectionKey, StaffAppScmInfoPdfAsset[]>;
  itemPdfs: Record<string, StaffAppScmInfoPdfAsset[]>;
}

export const STAFF_APP_SCM_INFO_PDF_LIMIT = 3;

export const staffAppScmInfoPdfSectionKeys: StaffAppScmInfoSectionKey[] = [
  "rolesTraining",
  "checklists",
  "platformInfo",
  "policy",
  "cashCard",
  "arenaInfo",
];

export const staffAppScmInfoItemPdfSectionKeys: StaffAppScmInfoItemPdfSectionKey[] = [
  "rolesTraining",
  "checklists",
  "platformInfo",
  "cashCard",
];

export function getSystemScmInfoItemPdfKey(
  sectionId: StaffAppScmInfoItemPdfSectionKey,
  itemIndex: number,
) {
  return `${sectionId}:${itemIndex}`;
}

export function createEmptyStaffAppScmInfoPdfAsset(): StaffAppScmInfoPdfAsset {
  return {
    pdfUrl: "",
    fileName: "",
    uploadedAt: "",
    uploadedBy: "",
    buttonLabel: "",
  };
}

export function createEmptyStaffAppScmInfoPdfSlots() {
  return Array.from({ length: STAFF_APP_SCM_INFO_PDF_LIMIT }, () =>
    createEmptyStaffAppScmInfoPdfAsset(),
  );
}

export function getStaffAppScmInfoPdfButtonLabel(
  asset: StaffAppScmInfoPdfAsset,
  fallbackLabel = "Open PDF",
) {
  return asset.buttonLabel?.trim() || fallbackLabel;
}
