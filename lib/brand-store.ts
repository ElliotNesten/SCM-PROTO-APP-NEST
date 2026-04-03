import { promises as fs } from "fs";
import path from "path";

export interface BrandSettings {
  logoUrl: string;
}

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "brand-store.json");
const defaultBrandSettings: BrandSettings = {
  logoUrl: "/brand/scm-logo.svg",
};

async function ensureBrandStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(defaultBrandSettings, null, 2), "utf8");
  }
}

async function readBrandStore(): Promise<BrandSettings> {
  await ensureBrandStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<BrandSettings>;

  return {
    ...defaultBrandSettings,
    ...parsed,
    logoUrl: parsed.logoUrl?.trim() || defaultBrandSettings.logoUrl,
  };
}

async function writeBrandStore(settings: BrandSettings) {
  await fs.writeFile(storePath, JSON.stringify(settings, null, 2), "utf8");
}

export async function getBrandSettings() {
  return readBrandStore();
}

export async function updateBrandLogo(logoUrl: string) {
  const nextSettings: BrandSettings = {
    logoUrl: logoUrl.trim() || defaultBrandSettings.logoUrl,
  };

  await writeBrandStore(nextSettings);
  return nextSettings;
}

