import { promises as fs } from "node:fs";
import path from "node:path";

export interface SystemPolicySettings {
  policyUrl: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
}

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-policy-store.json");
const defaultSystemPolicySettings: SystemPolicySettings = {
  policyUrl: "",
  fileName: "",
  uploadedAt: "",
  uploadedBy: "",
};

async function ensureSystemPolicyStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify(defaultSystemPolicySettings, null, 2),
      "utf8",
    );
  }
}

async function readSystemPolicyStore(): Promise<SystemPolicySettings> {
  await ensureSystemPolicyStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<SystemPolicySettings>;

  return {
    policyUrl: parsed.policyUrl?.trim() || "",
    fileName: parsed.fileName?.trim() || "",
    uploadedAt: parsed.uploadedAt?.trim() || "",
    uploadedBy: parsed.uploadedBy?.trim() || "",
  };
}

async function writeSystemPolicyStore(settings: SystemPolicySettings) {
  await fs.writeFile(storePath, JSON.stringify(settings, null, 2), "utf8");
}

export async function getSystemPolicySettings() {
  return readSystemPolicyStore();
}

export async function updateSystemPolicySettings(settings: Partial<SystemPolicySettings>) {
  const currentSettings = await readSystemPolicyStore();
  const nextSettings: SystemPolicySettings = {
    policyUrl: settings.policyUrl?.trim() || "",
    fileName: settings.fileName?.trim() || "",
    uploadedAt: settings.uploadedAt?.trim() || currentSettings.uploadedAt || "",
    uploadedBy: settings.uploadedBy?.trim() || currentSettings.uploadedBy || "",
  };

  await writeSystemPolicyStore(nextSettings);
  return nextSettings;
}
