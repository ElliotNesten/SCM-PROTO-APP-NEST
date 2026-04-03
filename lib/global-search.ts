import { formatDateLabel, resolveGigOverviewIndicator, shifts } from "@/data/scm-data";
import { getAllStoredGigs } from "@/lib/gig-store";
import { getAllStoredStaffProfiles } from "@/lib/staff-store";
import type { StoredStaffProfile } from "@/lib/staff-store";
import type { GlobalSearchResult } from "@/types/search";
import type { Gig, GigOverviewIndicator } from "@/types/scm";

type SearchIndexItem = GlobalSearchResult & {
  scoreBase: number;
  titleText: string;
  subtitleText: string;
  detailText: string;
  searchText: string;
};

const DEFAULT_LIMIT = 12;

const englishMonths = [
  { short: "jan", full: "january" },
  { short: "feb", full: "february" },
  { short: "mar", full: "march" },
  { short: "apr", full: "april" },
  { short: "may", full: "may" },
  { short: "jun", full: "june" },
  { short: "jul", full: "july" },
  { short: "aug", full: "august" },
  { short: "sep", full: "september" },
  { short: "oct", full: "october" },
  { short: "nov", full: "november" },
  { short: "dec", full: "december" },
] as const;

const swedishMonths = [
  { short: "jan", full: "januari" },
  { short: "feb", full: "februari" },
  { short: "mar", full: "mars" },
  { short: "apr", full: "april" },
  { short: "maj", full: "maj" },
  { short: "jun", full: "juni" },
  { short: "jul", full: "juli" },
  { short: "aug", full: "augusti" },
  { short: "sep", full: "september" },
  { short: "okt", full: "oktober" },
  { short: "nov", full: "november" },
  { short: "dec", full: "december" },
] as const;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function compactParts(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function compactList(parts: Array<string | null | undefined>, separator = " · ") {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(separator);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 102.4) / 10} KB`;
  }

  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function deriveFileExtension(fileName: string, extension?: string, mimeType?: string) {
  const explicitExtension = extension?.trim().replace(/^\./, "");

  if (explicitExtension) {
    return explicitExtension.toLowerCase();
  }

  const fileNameMatch = fileName.trim().match(/\.([a-z0-9]+)$/i);

  if (fileNameMatch?.[1]) {
    return fileNameMatch[1].toLowerCase();
  }

  if (mimeType?.includes("/")) {
    const mimeExtension = mimeType.split("/").pop()?.trim();

    if (mimeExtension) {
      return mimeExtension.toLowerCase();
    }
  }

  return "file";
}

function getIndicatorLabel(indicator: GigOverviewIndicator) {
  switch (indicator) {
    case "identified":
      return "Identified";
    case "inProgress":
      return "In Progress";
    case "confirmed":
      return "Confirmed";
    case "noMerch":
      return "No merch";
    default:
      return "In Progress";
  }
}

function getDateSearchTerms(date: string) {
  const [year, month, day] = date.split("-").map((value) => Number(value));

  if (!year || !month || !day) {
    return date;
  }

  const dayLabel = String(day);
  const monthIndex = month - 1;
  const english = englishMonths[monthIndex];
  const swedish = swedishMonths[monthIndex];

  if (!english || !swedish) {
    return date;
  }

  return compactParts([
    date,
    formatDateLabel(date),
    `${dayLabel}-${english.short}`,
    `${dayLabel} ${english.short}`,
    `${dayLabel} ${english.full}`,
    `${english.short} ${dayLabel}`,
    `${english.full} ${dayLabel}`,
    `${dayLabel}-${swedish.short}`,
    `${dayLabel} ${swedish.short}`,
    `${dayLabel} ${swedish.full}`,
    `${swedish.short} ${dayLabel}`,
    `${swedish.full} ${dayLabel}`,
    english.short,
    english.full,
    swedish.short,
    swedish.full,
    String(year),
  ]);
}

function createSearchIndexItem(
  item: Omit<SearchIndexItem, "titleText" | "subtitleText" | "detailText" | "searchText">,
  searchableParts: Array<string | null | undefined>,
): SearchIndexItem {
  const titleText = normalizeText(item.title);
  const subtitleText = normalizeText(item.subtitle);
  const detailText = normalizeText(item.detail ?? "");
  const searchText = normalizeText(compactParts(searchableParts));

  return {
    ...item,
    titleText,
    subtitleText,
    detailText,
    searchText,
  };
}

function scoreItem(item: SearchIndexItem, query: string, tokens: string[]) {
  if (tokens.some((token) => !item.searchText.includes(token))) {
    return 0;
  }

  let score = item.scoreBase;

  if (item.titleText === query) {
    score += 150;
  } else if (item.titleText.startsWith(query)) {
    score += 100;
  } else if (item.titleText.includes(query)) {
    score += 60;
  }

  if (item.subtitleText.includes(query)) {
    score += 25;
  }

  if (item.detailText.includes(query)) {
    score += 14;
  }

  for (const token of tokens) {
    if (item.titleText.startsWith(token)) {
      score += 35;
    } else if (item.titleText.includes(token)) {
      score += 22;
    }

    if (item.subtitleText.includes(token)) {
      score += 12;
    }

    if (item.detailText.includes(token)) {
      score += 6;
    }
  }

  return score;
}

function buildGigItems(gigs: Gig[]) {
  return gigs.map((gig) => {
    const overviewIndicator = getIndicatorLabel(resolveGigOverviewIndicator(gig));

    return createSearchIndexItem(
      {
        id: `gig-${gig.id}`,
        kind: "Gig",
        title: gig.artist,
        subtitle: `${gig.arena}, ${gig.city}, ${gig.country}`,
        detail: compactList([
          formatDateLabel(gig.date),
          gig.promoter,
          gig.projectManager ? `PM: ${gig.projectManager}` : "",
        ]),
        href: `/gigs/${gig.id}`,
        badge: overviewIndicator,
        scoreBase: 500,
      },
      [
        gig.artist,
        gig.arena,
        gig.city,
        gig.country,
        gig.region,
        getDateSearchTerms(gig.date),
        gig.promoter,
        gig.merchCompany,
        gig.merchRepresentative,
        gig.scmRepresentative,
        gig.projectManager,
        gig.notes,
        gig.arenaNotes,
        gig.securitySetup,
        gig.generalComments,
        overviewIndicator,
        ...(gig.customNoteFields ?? []).flatMap((item) => [item.title, item.body]),
        ...(gig.equipment ?? []).flatMap((item) => [item.label, String(item.quantity)]),
        ...(gig.files ?? []).flatMap((item) => [item.fileName, item.extension, item.folderName ?? ""]),
      ],
    );
  });
}

function buildShiftItems(gigs: Gig[], staffProfiles: StoredStaffProfile[]) {
  const gigById = new Map(gigs.map((gig) => [gig.id, gig]));
  const staffNameById = new Map(
    staffProfiles.map((profile) => [profile.id, `${profile.firstName} ${profile.lastName}`]),
  );

  return shifts
    .map((shift) => {
      const gig = gigById.get(shift.gigId);

      if (!gig) {
        return null;
      }

      const assignedNames = shift.assignments
        .map((assignment) => staffNameById.get(assignment.staffId) ?? assignment.staffId)
        .join(" ");

      return createSearchIndexItem(
        {
          id: `shift-${shift.id}`,
          kind: "Shift",
          title: `${gig.artist} · ${shift.role}`,
          subtitle: `${formatDateLabel(gig.date)} · ${gig.arena}, ${gig.city}`,
          detail: compactList([
            `${shift.startTime} - ${shift.endTime}`,
            shift.priorityTag,
            shift.skillRequirement,
          ]),
          href: `/gigs/${gig.id}/shifts/${shift.id}`,
          badge: `${shift.requiredStaff} needed`,
          scoreBase: 420,
        },
        [
          gig.artist,
          gig.arena,
          gig.city,
          gig.country,
          getDateSearchTerms(gig.date),
          shift.role,
          shift.startTime,
          shift.endTime,
          shift.notes,
          shift.skillRequirement,
          shift.priorityTag,
          assignedNames,
        ],
      );
    })
    .filter((item): item is SearchIndexItem => Boolean(item));
}

function buildGigFileItems(gigs: Gig[]) {
  return gigs.flatMap((gig) =>
    (gig.files ?? []).map((file) => {
      const extension = deriveFileExtension(file.fileName, file.extension, file.mimeType);

      return createSearchIndexItem(
        {
          id: `gig-file-${file.id}`,
          kind: "Gig file",
          title: file.fileName,
          subtitle: `${gig.artist} · ${gig.arena}, ${gig.city}`,
          detail: compactList([
            extension.toUpperCase(),
            formatBytes(file.fileSize),
            file.folderName ?? "",
          ]),
          href: `/gigs/${gig.id}?tab=files`,
          badge: "Files",
          scoreBase: 360,
        },
        [
          file.fileName,
          extension,
          file.mimeType,
          file.folderName ?? "",
          gig.artist,
          gig.arena,
          gig.city,
          gig.country,
          getDateSearchTerms(gig.date),
        ],
      );
    }),
  );
}

function buildStaffItems(staffProfiles: StoredStaffProfile[]) {
  return staffProfiles.map((profile) =>
    createSearchIndexItem(
      {
        id: `staff-${profile.id}`,
        kind: "Staff",
        title: `${profile.firstName} ${profile.lastName}`,
        subtitle: `${profile.region}, ${profile.country}`,
        detail: compactList([
          profile.email,
          profile.phone,
          profile.accessRoleLabel,
          profile.approvalStatus,
        ]),
        href: `/people/${profile.id}`,
        badge: profile.approvalStatus,
        scoreBase: 470,
      },
      [
        `${profile.firstName} ${profile.lastName}`,
        profile.email,
        profile.phone,
        profile.country,
        profile.region,
        profile.roles.join(" "),
        profile.accessRoleLabel,
        profile.approvalStatus,
        profile.registrationLabel,
        profile.bankDetails,
        profile.personalNumber,
        profile.profileComments,
        profile.pendingRecords.join(" "),
        ...(profile.documents ?? []).flatMap((document) => [
          document.fileName,
          document.fileType,
          document.storageKey,
        ]),
      ],
    ),
  );
}

function buildStaffDocumentItems(staffProfiles: StoredStaffProfile[]) {
  return staffProfiles.flatMap((profile) =>
    (profile.documents ?? []).map((document) =>
      createSearchIndexItem(
        {
          id: `staff-document-${profile.id}-${document.id}`,
          kind: "Staff document",
          title: document.fileName,
          subtitle: `${profile.firstName} ${profile.lastName} · ${profile.country}`,
          detail: compactList([document.fileType, formatBytes(document.fileSize)]),
          href: `/people/${profile.id}`,
          badge: "Document",
          scoreBase: 320,
        },
        [
          document.fileName,
          document.fileType,
          document.storageKey,
          `${profile.firstName} ${profile.lastName}`,
          profile.country,
          profile.region,
          profile.email,
        ],
      ),
    ),
  );
}

export async function searchGlobalContent(query: string, limit = DEFAULT_LIMIT) {
  const normalizedQuery = normalizeText(query.trim());

  if (!normalizedQuery) {
    return [] satisfies GlobalSearchResult[];
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const [gigs, staffProfiles] = await Promise.all([
    getAllStoredGigs(),
    getAllStoredStaffProfiles(),
  ]);

  const searchIndex = [
    ...buildGigItems(gigs),
    ...buildShiftItems(gigs, staffProfiles),
    ...buildGigFileItems(gigs),
    ...buildStaffItems(staffProfiles),
    ...buildStaffDocumentItems(staffProfiles),
  ];

  return searchIndex
    .map((item) => ({
      item,
      score: scoreItem(item, normalizedQuery, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.item.title.localeCompare(right.item.title);
    })
    .slice(0, limit)
    .map((entry) => ({
      id: entry.item.id,
      kind: entry.item.kind,
      title: entry.item.title,
      subtitle: entry.item.subtitle,
      detail: entry.item.detail,
      href: entry.item.href,
      badge: entry.item.badge,
    }));
}
