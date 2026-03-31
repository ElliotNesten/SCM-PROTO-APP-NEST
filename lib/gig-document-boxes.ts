import type { GigDocumentSection, GigFileItem } from "@/types/scm";

const eventManagerDocumentBoxTitle = "Event Manager";
const reportGigFilesDocumentBoxBaseTitle = "Gig files";
const endOfDayReportReceiptsDocumentBoxTitle = "End-of-Day Report & Receipts";

export type GigDocumentBoxContext = {
  gigArtist?: string;
};

type GigDocumentBoxDefinition = {
  id?: string;
  title: string;
  aliases: readonly string[];
  isDynamicReportGigFiles?: boolean;
};

const gigDocumentBoxes = {
  files: {
    default: [
      {
        id: "emails",
        title: "E-mails",
        aliases: ["Email", "Emails", "Email Threads"],
      },
      {
        id: "range-prices",
        title: "Range & prices",
        aliases: ["Range and prices", "Range & Pricing", "Prices", "Pricing"],
      },
    ],
    legacy: [
      {
        title: "Gig Info",
        aliases: ["Giginfo"],
      },
      {
        title: "General Files",
        aliases: [],
      },
    ],
  },
  reports: {
    default: [
      {
        id: "event-manager",
        title: "Event Manager",
        aliases: [],
      },
      {
        id: "gig-files",
        title: "Gig files",
        aliases: [
          "Gig Files",
          "Sales Report",
          "Cash Report",
          "To Be Invoiced",
        ],
        isDynamicReportGigFiles: true,
      },
      {
        id: "end-of-day-report-receipts",
        title: "End-of-Day Report & Receipts",
        aliases: [
          "End of Day Report & Receipts",
          "End-of-Day Report and Receipts",
          "End of Day Report and Receipts",
          "Receipts",
        ],
      },
    ],
    legacy: [
      {
        title: "Gig files",
        aliases: [
          "Sales Sheet",
          "Site Plan",
          "Email Threads",
          "Mailtradar",
          "Support Documents",
          "Supportakter",
          "Other Documents",
          "Ovriga dokument",
        ],
        isDynamicReportGigFiles: true,
      },
    ],
  },
} as const satisfies Record<
  GigDocumentSection,
  {
    default: readonly GigDocumentBoxDefinition[];
    legacy: readonly GigDocumentBoxDefinition[];
  }
>;

export function isGigDocumentSection(value: string): value is GigDocumentSection {
  return value === "files" || value === "reports";
}

export function getReportGigFilesDocumentBoxTitle(context?: GigDocumentBoxContext) {
  const gigArtist = context?.gigArtist?.trim();
  return gigArtist ? `${gigArtist} gig files` : reportGigFilesDocumentBoxBaseTitle;
}

export function normalizeGigDocumentBoxName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveGigDocumentBoxDefinition(
  section: GigDocumentSection,
  definition: GigDocumentBoxDefinition,
  context?: GigDocumentBoxContext,
) {
  if (section === "reports" && definition.isDynamicReportGigFiles) {
    return {
      ...definition,
      title: getReportGigFilesDocumentBoxTitle(context),
    };
  }

  return definition;
}

function isReportGigFilesDefaultMatch(value: string, context?: GigDocumentBoxContext) {
  const normalizedValue = normalizeGigDocumentBoxName(value);

  if (!normalizedValue) {
    return false;
  }

  if (normalizedValue === normalizeGigDocumentBoxName(getReportGigFilesDocumentBoxTitle(context))) {
    return true;
  }

  if (normalizedValue === normalizeGigDocumentBoxName(reportGigFilesDocumentBoxBaseTitle)) {
    return true;
  }

  return normalizedValue.endsWith("-gig-files");
}

export function getDefaultGigDocumentBoxes(
  section: GigDocumentSection,
  context?: GigDocumentBoxContext,
) {
  return gigDocumentBoxes[section].default.map((definition) =>
    resolveGigDocumentBoxDefinition(section, definition, context),
  );
}

function getKnownGigDocumentBoxes(section: GigDocumentSection, context?: GigDocumentBoxContext) {
  return [...gigDocumentBoxes[section].default, ...gigDocumentBoxes[section].legacy].map(
    (definition) => resolveGigDocumentBoxDefinition(section, definition, context),
  );
}

export function getCanonicalGigDocumentBoxTitle(
  section: GigDocumentSection,
  value: string,
  context?: GigDocumentBoxContext,
) {
  const normalizedValue = normalizeGigDocumentBoxName(value);

  if (!normalizedValue) {
    return "";
  }

  if (section === "reports" && isReportGigFilesDefaultMatch(value, context)) {
    return getReportGigFilesDocumentBoxTitle(context);
  }

  const matchedBox = getKnownGigDocumentBoxes(section, context).find((box) => {
    if (normalizeGigDocumentBoxName(box.title) === normalizedValue) {
      return true;
    }

    return box.aliases.some((alias) => normalizeGigDocumentBoxName(alias) === normalizedValue);
  });

  return matchedBox?.title ?? value.trim();
}

export function getGigDocumentBoxMatchNames(
  section: GigDocumentSection,
  value: string,
  context?: GigDocumentBoxContext,
) {
  const canonicalTitle = getCanonicalGigDocumentBoxTitle(section, value, context);

  if (!canonicalTitle) {
    return [] as string[];
  }

  const matchedBoxes = getKnownGigDocumentBoxes(section, context).filter(
    (box) => normalizeGigDocumentBoxName(box.title) === normalizeGigDocumentBoxName(canonicalTitle),
  );

  if (matchedBoxes.length === 0) {
    return [canonicalTitle];
  }

  return Array.from(
    new Set(
      matchedBoxes.flatMap((box) => [box.title, ...box.aliases]).filter(Boolean),
    ),
  );
}

export function isDefaultGigDocumentBoxTitle(
  section: GigDocumentSection,
  value: string,
  context?: GigDocumentBoxContext,
) {
  const normalizedValue = normalizeGigDocumentBoxName(
    getCanonicalGigDocumentBoxTitle(section, value, context),
  );

  if (!normalizedValue) {
    return false;
  }

  return getDefaultGigDocumentBoxes(section, context).some(
    (box) => normalizeGigDocumentBoxName(box.title) === normalizedValue,
  );
}

export function isEventManagerGigDocumentBox(
  section: GigDocumentSection,
  value: string,
  context?: GigDocumentBoxContext,
) {
  if (section !== "reports") {
    return false;
  }

  return (
    normalizeGigDocumentBoxName(getCanonicalGigDocumentBoxTitle(section, value, context)) ===
    normalizeGigDocumentBoxName(eventManagerDocumentBoxTitle)
  );
}

export function isEndOfDayReportReceiptsGigDocumentBox(
  section: GigDocumentSection,
  value: string,
  context?: GigDocumentBoxContext,
) {
  if (section !== "reports") {
    return false;
  }

  return (
    normalizeGigDocumentBoxName(getCanonicalGigDocumentBoxTitle(section, value, context)) ===
    normalizeGigDocumentBoxName(endOfDayReportReceiptsDocumentBoxTitle)
  );
}

export function inferGigDocumentSectionFromFolderName(
  value: string,
  context?: GigDocumentBoxContext,
) {
  const normalizedValue = normalizeGigDocumentBoxName(value);

  if (!normalizedValue) {
    return null;
  }

  const matchingSection = (Object.keys(gigDocumentBoxes) as GigDocumentSection[]).find(
    (section) =>
      getKnownGigDocumentBoxes(section, context).some((box) => {
        if (section === "reports" && box.isDynamicReportGigFiles) {
          return isReportGigFilesDefaultMatch(value, context);
        }

        if (normalizeGigDocumentBoxName(box.title) === normalizedValue) {
          return true;
        }

        return box.aliases.some((alias) => normalizeGigDocumentBoxName(alias) === normalizedValue);
      }),
  );

  return matchingSection ?? null;
}

export function inferLegacyGigFileBoxTitle(file: Pick<GigFileItem, "fileName" | "extension">) {
  const normalizedFileName = file.fileName.trim().toLowerCase();
  const normalizedExtension = file.extension?.trim().toLowerCase() ?? "";

  if (
    normalizedExtension === "msg" ||
    /(^|[\s_-])(re|fw|fwd)([\s:_-]|$)/.test(normalizedFileName) ||
    /\b(e-?mail|mail)\b/.test(normalizedFileName)
  ) {
    return "E-mails";
  }

  if (
    normalizedExtension === "xlsx" ||
    /\b(range|price|prices|pricing|price-list|pricelist)\b/.test(normalizedFileName)
  ) {
    return "Range & prices";
  }

  return "General Files";
}
