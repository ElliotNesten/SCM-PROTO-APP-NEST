import { promises as fs } from "node:fs";
import path from "node:path";

import {
  createEmptyArenaCatalogDocuments,
  defaultArenaCatalog,
  type ArenaCatalogDocumentAsset,
  type ArenaCatalogDocumentKey,
  type ArenaCatalogEntry,
} from "@/data/predefined-arenas";
import { equipmentOptions } from "@/data/equipment-options";
import { normalizeScandinavianCountry } from "@/lib/scandinavian-countries";
import {
  readSingletonSystemSetting,
  writeSingletonSystemSetting,
} from "@/lib/system-singleton-store";
import type { StaffAppGuideEntry } from "@/lib/staff-app-guides";

export type StaffAppScmInfoSectionKey =
  | "rolesTraining"
  | "checklists"
  | "platformInfo"
  | "policy"
  | "cashCard"
  | "arenaInfo";

export interface StaffAppScmInfoHubCard {
  title: string;
  subtitle: string;
}

export interface StaffAppScmInfoGuideSection {
  pageTitle: string;
  pageDescription: string;
  items: StaffAppGuideEntry[];
}

export interface StaffAppScmArenaInfoSettings {
  pageTitle: string;
  pageDescription: string;
  fallbackArenaNoteTemplate: string;
  emptyStateMessage: string;
  catalog: ArenaCatalogEntry[];
}

export interface StaffAppScmInfoSettings {
  hubKicker: string;
  hubTitle: string;
  hubCards: Record<StaffAppScmInfoSectionKey, StaffAppScmInfoHubCard>;
  rolesTraining: StaffAppScmInfoGuideSection;
  checklists: StaffAppScmInfoGuideSection;
  platformInfo: StaffAppScmInfoGuideSection;
  cashCard: StaffAppScmInfoGuideSection;
  arenaInfo: StaffAppScmArenaInfoSettings;
}

const equipmentSummary = equipmentOptions.map((item) => item.label).join(", ");
const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "system-scm-info-store.json");
const systemSettingKey = "systemScmInfo";
const defaultArenaInfoPageDescription =
  "Filter countries first, then browse registered SCM arenas and open venue PDFs.";
const legacyArenaInfoPageDescription =
  "Filter countries first, then browse registered SCM arenas and venue notes.";

function createDefaultStaffAppScmInfoSettings(): StaffAppScmInfoSettings {
  return {
    hubKicker: "Guides",
    hubTitle: "SCM Info",
    hubCards: {
      rolesTraining: {
        title: "Roles & Training",
        subtitle: "Role basics and onboarding notes",
      },
      checklists: {
        title: "Checklists",
        subtitle: "Pre-shift and setup reminders",
      },
      platformInfo: {
        title: "SCM Info",
        subtitle: "Contact, FAQ, and updates",
      },
      policy: {
        title: "Policy",
        subtitle: "Open the SCM staff policy PDF",
      },
      cashCard: {
        title: "Cash & Card Terminal Info",
        subtitle: "Till, terminal, and closeout guidance",
      },
      arenaInfo: {
        title: "Arena Info",
        subtitle: "Browse venues by country",
      },
    },
    rolesTraining: {
      pageTitle: "Roles & Training",
      pageDescription: "Approved roles are shown here together with key role guidance.",
      items: [
        {
          title: "Seller",
          subtitle: "Sales flow, customer service, and stand routines.",
          body:
            "Greet guests quickly, keep the queue moving, confirm pricing before each sale, and report low stock in the shift chat as soon as it affects service.",
        },
        {
          title: "Stand Leader",
          subtitle: "Briefing, delegation, and on-floor escalation.",
          body:
            "Run the pre-door briefing, assign stand zones, monitor floats and stock levels, and escalate venue issues to the responsible manager without delay.",
        },
        {
          title: "Other Info",
          subtitle: "Shared expectations across every approved SCM role.",
          body:
            "Follow meeting times, uniform instructions, and shift notes, use Check In / Out on the live shift day, and keep all practical questions in the linked shift thread.",
        },
      ],
    },
    checklists: {
      pageTitle: "Checklists",
      pageDescription: "Open the most common pre-shift and on-site reminders for SCM staff.",
      items: [
        {
          title: "Gig Checklist",
          subtitle: "What to confirm before you leave for the venue.",
          body:
            "Review shift notes, confirm your meeting point and manager, charge your phone, pack your uniform, and make sure you can access the right documents before departure.",
        },
        {
          title: "Equipment",
          subtitle: "Core setup items to verify on site.",
          body: `When relevant to the venue, confirm the pack includes ${equipmentSummary}. Report missing setup items before doors open.`,
        },
        {
          title: "Tent",
          subtitle: "Outdoor setup and weather-readiness basics.",
          body:
            "For outdoor sales areas, confirm anchoring, weather cover, lighting, and safe walkways before opening so the setup stays compliant and safe.",
        },
        {
          title: "Info Letter",
          subtitle: "Operational notes you should read before arrival.",
          body:
            "Read the event info letter ahead of time so you know access route, doors time, sales setup, and any promoter-specific instructions that affect the shift.",
        },
      ],
    },
    platformInfo: {
      pageTitle: "SCM Info",
      pageDescription: "General reference information, contact paths, and quick platform guidance.",
      items: [
        {
          title: "Contact",
          subtitle: "Who to contact during a running shift.",
          body:
            "Use the shift-linked chat first. For urgent operational issues, contact the responsible manager or project lead shown in your shift details.",
        },
        {
          title: "FAQ",
          subtitle: "Quick answers to common staff questions.",
          body:
            "If you are unsure about timing, role scope, attendance, or documents, check the relevant guide first and then escalate in the shift thread if something is still unclear.",
        },
        {
          title: "News",
          subtitle: "Current notices from SCM operations.",
          body:
            "Latest process updates, operational reminders, and rollout notes are shared here in the staff app and by your managers when something changes.",
        },
      ],
    },
    cashCard: {
      pageTitle: "Cash & Card Terminal Info",
      pageDescription: "Practical till, terminal, and closeout routines for running sales shifts.",
      items: [
        {
          title: "Cash Handling",
          subtitle: "Floats, counting, and reconciliation.",
          body:
            "Count floats with a lead, never leave open cash unattended, and reconcile any differences before signing off at the end of the shift.",
        },
        {
          title: "Card Terminals",
          subtitle: "Startup, charging, and connectivity.",
          body:
            "Check battery level, connectivity, receipt settings, and a payment test before doors. Report terminal issues immediately so the stand can stay live.",
        },
        {
          title: "Closeout",
          subtitle: "What must happen before tills are returned.",
          body:
            "Run end-of-shift totals, return tills and accessories to the agreed handoff point, and confirm that time reporting matches the actual finish time.",
        },
      ],
    },
    arenaInfo: {
      pageTitle: "Arena Info",
      pageDescription: defaultArenaInfoPageDescription,
      fallbackArenaNoteTemplate: "SCM venue reference for {arena} in {city}.",
      emptyStateMessage: "No arenas are currently listed for this country.",
      catalog: defaultArenaCatalog,
    },
  };
}

function normalizeString(value: string | undefined, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeGuideEntry(rawEntry: Partial<StaffAppGuideEntry> | null | undefined) {
  return {
    title: normalizeString(rawEntry?.title),
    subtitle: normalizeString(rawEntry?.subtitle),
    body: normalizeString(rawEntry?.body),
  } satisfies StaffAppGuideEntry;
}

function normalizeGuideSection(
  rawSection: Partial<StaffAppScmInfoGuideSection> | null | undefined,
  fallbackSection: StaffAppScmInfoGuideSection,
) {
  return {
    pageTitle: normalizeString(rawSection?.pageTitle, fallbackSection.pageTitle),
    pageDescription: normalizeString(rawSection?.pageDescription, fallbackSection.pageDescription),
    items:
      Array.isArray(rawSection?.items) && rawSection.items.length > 0
        ? rawSection.items.map((item) => normalizeGuideEntry(item))
        : fallbackSection.items,
  } satisfies StaffAppScmInfoGuideSection;
}

function normalizeHubCard(
  rawCard: Partial<StaffAppScmInfoHubCard> | null | undefined,
  fallbackCard: StaffAppScmInfoHubCard,
) {
  return {
    title: normalizeString(rawCard?.title, fallbackCard.title),
    subtitle: normalizeString(rawCard?.subtitle, fallbackCard.subtitle),
  } satisfies StaffAppScmInfoHubCard;
}

function normalizeArenaCatalogDocumentAsset(
  rawAsset: Partial<ArenaCatalogDocumentAsset> | null | undefined,
) {
  return {
    pdfUrl: normalizeString(rawAsset?.pdfUrl),
    fileName: normalizeString(rawAsset?.fileName),
    uploadedAt: normalizeString(rawAsset?.uploadedAt),
    uploadedBy: normalizeString(rawAsset?.uploadedBy),
  } satisfies ArenaCatalogDocumentAsset;
}

function normalizeArenaCatalogDocuments(
  rawDocuments:
    | Partial<Record<ArenaCatalogDocumentKey, Partial<ArenaCatalogDocumentAsset>>>
    | null
    | undefined,
) {
  const emptyDocuments = createEmptyArenaCatalogDocuments();

  return {
    arenaInfo: normalizeArenaCatalogDocumentAsset(
      rawDocuments?.arenaInfo ?? emptyDocuments.arenaInfo,
    ),
    fireEscapePlan: normalizeArenaCatalogDocumentAsset(
      rawDocuments?.fireEscapePlan ?? emptyDocuments.fireEscapePlan,
    ),
  } satisfies Record<ArenaCatalogDocumentKey, ArenaCatalogDocumentAsset>;
}

function normalizeArenaCatalogEntry(
  rawEntry: Partial<ArenaCatalogEntry> | null | undefined,
  index: number,
) {
  const name = normalizeString(rawEntry?.name);
  const city = normalizeString(rawEntry?.city);
  const country = normalizeScandinavianCountry(normalizeString(rawEntry?.country));

  if (!name || !city || !country) {
    return null;
  }

  return {
    id: normalizeString(rawEntry?.id, `arena-${index + 1}`),
    name,
    city,
    country,
    aliases: Array.from(
      new Set(
        Array.isArray(rawEntry?.aliases)
          ? rawEntry.aliases.map((alias) => normalizeString(alias)).filter(Boolean)
          : [],
      ),
    ),
    documents: normalizeArenaCatalogDocuments(rawEntry?.documents),
  } satisfies ArenaCatalogEntry;
}

function normalizeStoredStaffAppScmInfoSettings(
  rawSettings: Partial<StaffAppScmInfoSettings> | null | undefined,
) {
  const fallbackSettings = createDefaultStaffAppScmInfoSettings();
  const normalizedArenaInfoPageDescription = normalizeString(
    rawSettings?.arenaInfo?.pageDescription,
    fallbackSettings.arenaInfo.pageDescription,
  );
  const normalizedArenaCatalog =
    Array.isArray(rawSettings?.arenaInfo?.catalog) && rawSettings.arenaInfo.catalog.length > 0
      ? rawSettings.arenaInfo.catalog
          .map((entry, index) => normalizeArenaCatalogEntry(entry, index))
          .filter((entry): entry is ArenaCatalogEntry => entry !== null)
      : fallbackSettings.arenaInfo.catalog;

  return {
    hubKicker: normalizeString(rawSettings?.hubKicker, fallbackSettings.hubKicker),
    hubTitle: normalizeString(rawSettings?.hubTitle, fallbackSettings.hubTitle),
    hubCards: {
      rolesTraining: normalizeHubCard(
        rawSettings?.hubCards?.rolesTraining,
        fallbackSettings.hubCards.rolesTraining,
      ),
      checklists: normalizeHubCard(
        rawSettings?.hubCards?.checklists,
        fallbackSettings.hubCards.checklists,
      ),
      platformInfo: normalizeHubCard(
        rawSettings?.hubCards?.platformInfo,
        fallbackSettings.hubCards.platformInfo,
      ),
      policy: normalizeHubCard(rawSettings?.hubCards?.policy, fallbackSettings.hubCards.policy),
      cashCard: normalizeHubCard(
        rawSettings?.hubCards?.cashCard,
        fallbackSettings.hubCards.cashCard,
      ),
      arenaInfo: normalizeHubCard(
        rawSettings?.hubCards?.arenaInfo,
        fallbackSettings.hubCards.arenaInfo,
      ),
    },
    rolesTraining: normalizeGuideSection(
      rawSettings?.rolesTraining,
      fallbackSettings.rolesTraining,
    ),
    checklists: normalizeGuideSection(rawSettings?.checklists, fallbackSettings.checklists),
    platformInfo: normalizeGuideSection(
      rawSettings?.platformInfo,
      fallbackSettings.platformInfo,
    ),
    cashCard: normalizeGuideSection(rawSettings?.cashCard, fallbackSettings.cashCard),
    arenaInfo: {
      pageTitle: normalizeString(
        rawSettings?.arenaInfo?.pageTitle,
        fallbackSettings.arenaInfo.pageTitle,
      ),
      pageDescription:
        normalizedArenaInfoPageDescription === legacyArenaInfoPageDescription
          ? fallbackSettings.arenaInfo.pageDescription
          : normalizedArenaInfoPageDescription,
      fallbackArenaNoteTemplate: normalizeString(
        rawSettings?.arenaInfo?.fallbackArenaNoteTemplate,
        fallbackSettings.arenaInfo.fallbackArenaNoteTemplate,
      ),
      emptyStateMessage: normalizeString(
        rawSettings?.arenaInfo?.emptyStateMessage,
        fallbackSettings.arenaInfo.emptyStateMessage,
      ),
      catalog:
        normalizedArenaCatalog.length > 0
          ? normalizedArenaCatalog
          : fallbackSettings.arenaInfo.catalog,
    },
  } satisfies StaffAppScmInfoSettings;
}

async function readSystemScmInfoStoreSnapshot() {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return normalizeStoredStaffAppScmInfoSettings(
      JSON.parse(raw) as Partial<StaffAppScmInfoSettings>,
    );
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    if (readError.code === "ENOENT") {
      return createDefaultStaffAppScmInfoSettings();
    }

    throw error;
  }
}

async function writeSystemScmInfoStore(settings: StaffAppScmInfoSettings) {
  await fs.mkdir(storeDirectory, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(settings, null, 2), "utf8");
}

export async function getSystemScmInfoSettings() {
  return readSingletonSystemSetting({
    settingKey: systemSettingKey,
    normalize: normalizeStoredStaffAppScmInfoSettings,
    readFallback: readSystemScmInfoStoreSnapshot,
  });
}

export async function updateSystemScmInfoSettings(
  settings: Partial<StaffAppScmInfoSettings>,
) {
  return writeSingletonSystemSetting({
    settingKey: systemSettingKey,
    value: settings,
    normalize: normalizeStoredStaffAppScmInfoSettings,
    writeFallback: writeSystemScmInfoStore,
  });
}

export function renderArenaNoteTemplate(
  template: string,
  context: { arena: string; city: string; country: string },
) {
  return template
    .replaceAll("{arena}", context.arena)
    .replaceAll("{city}", context.city)
    .replaceAll("{country}", context.country);
}
