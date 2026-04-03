import {
  getAllStoredGigs,
  getGigTemporaryManagerTimeline,
  getVisibleTemporaryGigManagerGigsForStaffProfile,
} from "@/lib/gig-store";
import {
  formatHourlyRateLabel,
  resolveEffectiveHourlyRate,
} from "@/lib/compensation";
import { getStaffAppPayrollSnapshots } from "@/lib/staff-app-payroll";
import {
  buildStaffAppFeedPassId,
} from "@/lib/staff-app-pass-ids";
import {
  buildShiftCommunicationThreadTarget,
  resolveShiftCommunicationThreadAllowReplies,
} from "@/lib/shift-communication-threads";
import { getAllStoredShiftCommunicationStates } from "@/lib/shift-communication-store";
import { getStaffAppLevelForRole } from "@/lib/staff-app-scope";
import { getAllStoredShifts } from "@/lib/shift-store";
import { getStoredStaffDocuments } from "@/lib/staff-document-store";
import {
  getAllStoredStaffProfiles,
  getStoredStaffProfileById,
} from "@/lib/staff-store";
import { getSystemCompensationSettings } from "@/lib/system-compensation-store";
import type { CompensationRateMatrix } from "@/types/compensation";
import type { Assignment, Gig, Shift, ShiftMessageRecord } from "@/types/scm";
import type {
  StaffAppAccount,
  StaffAppColleague,
  StaffAppDocumentLink,
  StaffAppLevel,
  StaffAppManagedGig,
  StaffAppMessageThread,
  StaffAppOpenPass,
  StaffAppRole,
  StaffAppScheduledShift,
} from "@/types/staff-app";
import type { StaffRoleKey, StoredStaffRoleProfiles } from "@/types/staff-role";

type StaffAppPassSeed = {
  id: string;
  gigId: string;
  shiftId?: string;
  feed: "open" | "standby" | "unassigned";
  role: StaffAppRole;
  eligibleCountry: string;
  eligibleRegions: string[];
  eligibleRoles: StaffAppRole[];
  eligibleLevels: Array<1 | 2 | 3 | 4 | 5>;
  publishedAt: string;
  operationsNote: string;
  statusMessage: string;
  fallbackStartTime?: string;
  fallbackEndTime?: string;
  payRateLabel?: string;
  dressCode?: string;
};

type StaffAppScheduleOptions = {
  account?: StaffAppAccount;
  includePast?: boolean;
};

type StaffAppMessageThreadOptions = {
  includePastSchedule?: boolean;
  includeEmptyShiftThreads?: boolean;
};

type StaffAppThreadAccumulator = StaffAppMessageThread & {
  sortTime: string;
  lastActivityAt?: string;
};

type StaffAppPassFeed = StaffAppOpenPass["feed"];

const passSeeds: StaffAppPassSeed[] = [
  {
    id: "pass-melo-lead",
    gigId: "gig-1",
    shiftId: "shift-1",
    feed: "open",
    role: "Stand Leader",
    eligibleCountry: "Sweden",
    eligibleRegions: ["Stockholm"],
    eligibleRoles: ["Stand Leader"],
    eligibleLevels: [1],
    publishedAt: "2026-03-28T07:30:00.000Z",
    operationsNote: "Lead the south-floor merch zone and brief the seller team before doors.",
    statusMessage: "Available shifts you can apply for.",
    payRateLabel: "SEK 180 / hour",
    dressCode: "SCM uniform required",
  },
  {
    id: "pass-melo-seller",
    gigId: "gig-1",
    shiftId: "shift-2",
    feed: "open",
    role: "Seller",
    eligibleCountry: "Sweden",
    eligibleRegions: ["Stockholm"],
    eligibleRoles: ["Seller"],
    eligibleLevels: [1, 2],
    publishedAt: "2026-03-28T07:30:00.000Z",
    operationsNote: "High-volume seller position near the main concourse tills.",
    statusMessage: "Available shifts you can apply for.",
    payRateLabel: "SEK 150 / hour",
    dressCode: "SCM uniform required",
  },
  {
    id: "pass-neon-west",
    gigId: "gig-2",
    shiftId: "shift-5",
    feed: "open",
    role: "Seller",
    eligibleCountry: "Sweden",
    eligibleRegions: ["Gothenburg"],
    eligibleRoles: ["Seller"],
    eligibleLevels: [1, 2],
    publishedAt: "2026-03-28T08:15:00.000Z",
    operationsNote: "Seller call for the west entrance stand.",
    statusMessage: "Available shifts you can apply for.",
    payRateLabel: "SEK 150 / hour",
    dressCode: "SCM uniform required",
  },
  {
    id: "pass-fjord-oslo",
    gigId: "gig-3",
    shiftId: "shift-7",
    feed: "open",
    role: "Stand Leader",
    eligibleCountry: "Norway",
    eligibleRegions: ["Oslo"],
    eligibleRoles: ["Stand Leader"],
    eligibleLevels: [1],
    publishedAt: "2026-03-29T06:45:00.000Z",
    operationsNote: "Oslo floor lead reserved for Norway-based senior staff.",
    statusMessage: "Available shifts you can apply for.",
    payRateLabel: "SEK 185 / hour",
    dressCode: "SCM uniform required",
  },
  {
    id: "pass-signal-south",
    gigId: "gig-5",
    feed: "open",
    role: "Runner",
    eligibleCountry: "Sweden",
    eligibleRegions: ["Malmo"],
    eligibleRoles: ["Runner"],
    eligibleLevels: [2, 3],
    publishedAt: "2026-03-29T08:20:00.000Z",
    operationsNote: "Back-of-house runner coverage for the south region.",
    statusMessage: "Available shifts you can apply for.",
    fallbackStartTime: "15:00",
    fallbackEndTime: "23:45",
    payRateLabel: "SEK 145 / hour",
    dressCode: "SCM uniform required",
  },
  {
    id: "pass-standby-melo-seller",
    gigId: "gig-1",
    feed: "standby",
    role: "Seller",
    eligibleCountry: "Sweden",
    eligibleRegions: ["Stockholm"],
    eligibleRoles: ["Seller"],
    eligibleLevels: [1, 2],
    publishedAt: "2026-03-29T09:00:00.000Z",
    operationsNote: "Standby seller slot for late staffing changes at the arena floor.",
    statusMessage: "You are on the standby list for this gig.",
    fallbackStartTime: "16:00",
    fallbackEndTime: "23:00",
    payRateLabel: "SEK 150 / hour",
    dressCode: "SCM uniform required",
  },
  {
    id: "pass-unassigned-melo-lead",
    gigId: "gig-1",
    feed: "unassigned",
    role: "Stand Leader",
    eligibleCountry: "Sweden",
    eligibleRegions: ["Stockholm"],
    eligibleRoles: ["Stand Leader"],
    eligibleLevels: [1],
    publishedAt: "2026-03-29T09:15:00.000Z",
    operationsNote: "Lead slot has already been allocated to another team member.",
    statusMessage: "You are unfortunately not booked for this pass.",
    fallbackStartTime: "16:00",
    fallbackEndTime: "23:00",
    payRateLabel: "SEK 180 / hour",
    dressCode: "SCM uniform required",
  },
];

function getTodayInStockholm() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getGigDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`);
}

function sortByUpcoming(left: { date: string; startTime: string }, right: { date: string; startTime: string }) {
  return (
    getGigDateTime(left.date, left.startTime).getTime() -
    getGigDateTime(right.date, right.startTime).getTime()
  );
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(parsed);
}

function normalizeRegion(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCountry(value: string) {
  return value.trim().toLowerCase();
}

function shouldRestrictPassesToRegion(country: string) {
  return normalizeCountry(country) === "sweden";
}

function getEligiblePassRegions(country: string, regions: string[]) {
  if (!shouldRestrictPassesToRegion(country)) {
    return [] as string[];
  }

  return regions.map((region) => region.trim()).filter(Boolean);
}

function findGigById(gigs: Gig[], gigId: string) {
  return gigs.find((gig) => gig.id === gigId) ?? null;
}

function findShiftById(shifts: Shift[], shiftId: string | undefined) {
  if (!shiftId) {
    return null;
  }

  return shifts.find((shift) => shift.id === shiftId) ?? null;
}

function countConfirmedAssignments(shift: Shift) {
  return shift.assignments.filter((assignment) => assignment.bookingStatus === "Confirmed").length;
}

function getShiftOpenSlots(shift: Shift) {
  return Math.max(shift.requiredStaff - countConfirmedAssignments(shift), 0);
}

function getDefaultOperationsNote(role: StaffAppRole) {
  if (role === "Stand Leader") {
    return "Lead the shift, brief the team, and support the merch operation on site.";
  }

  if (role === "Seller") {
    return "Sales floor position with customer handling and POS responsibility during the shift.";
  }

  return "Support stock flow and practical back-of-house coverage during the shift.";
}

function mapStaffAppRoleToStaffRoleKey(role: StaffAppRole): StaffRoleKey {
  return role;
}

function getAssignmentPayRateLabel(assignment: Assignment | undefined) {
  if (
    !assignment ||
    typeof assignment.hourlyRate !== "number" ||
    !Number.isFinite(assignment.hourlyRate) ||
    typeof assignment.hourlyRateCurrency !== "string" ||
    assignment.hourlyRateCurrency.trim().length === 0
  ) {
    return null;
  }

  return `${assignment.hourlyRateCurrency.trim().toUpperCase()} ${Math.round(
    assignment.hourlyRate,
  )} / h`;
}

function getEffectivePayRateLabel(args: {
  country: string;
  role: StaffAppRole;
  defaultHourlyRates: CompensationRateMatrix;
  roleProfiles?: Partial<StoredStaffRoleProfiles> | null;
}) {
  return resolveEffectiveHourlyRate({
    country: args.country,
    roleKey: mapStaffAppRoleToStaffRoleKey(args.role),
    roleProfiles: args.roleProfiles,
    defaultHourlyRates: args.defaultHourlyRates,
  }).label;
}

async function getPassCompensationContext(account?: StaffAppAccount) {
  const linkedStaffProfileId = account?.linkedStaffProfileId?.trim() ?? "";
  const [compensationSettings, linkedStaffProfile] = await Promise.all([
    getSystemCompensationSettings(),
    linkedStaffProfileId
      ? getStoredStaffProfileById(linkedStaffProfileId)
      : Promise.resolve(null),
  ]);

  return {
    defaultHourlyRates: compensationSettings.defaultHourlyRates,
    linkedStaffProfile,
  };
}

function isGigMarkedNoMerch(gig: Gig) {
  return gig.overviewIndicator === "noMerch";
}

function getDefaultStatusMessageForFeed(feed: StaffAppPassFeed) {
  if (feed === "standby") {
    return "You are on the waitlist for this shift.";
  }

  if (feed === "unassigned") {
    return "This shift is still not booked to you.";
  }

  return "Available shifts you can apply for.";
}

function isGigEligibleForOpenStaffAppPasses(gig: Gig) {
  if (isGigMarkedNoMerch(gig)) {
    return false;
  }

  if (gig.status === "Closed" || gig.status === "Reported" || gig.status === "Completed") {
    return false;
  }

  return true;
}

function buildDynamicShiftPass(
  gig: Gig,
  shift: Shift,
  feed: StaffAppPassFeed,
  payRateLabel?: string,
): StaffAppOpenPass | null {
  if (!isStaffAppRole(shift.role)) {
    return null;
  }

  if (!isGigEligibleForOpenStaffAppPasses(gig)) {
    return null;
  }

  return {
    id: buildStaffAppFeedPassId(feed, shift.id),
    gigId: gig.id,
    shiftId: shift.id,
    feed,
    artist: gig.artist,
    arena: gig.arena,
    city: gig.city,
    country: gig.country,
    region: gig.region,
    date: gig.date,
    startTime: shift.startTime || gig.startTime,
    endTime: shift.endTime || gig.endTime,
    role: shift.role,
    eligibleCountry: gig.country,
    eligibleRegions: getEligiblePassRegions(gig.country, [gig.region]),
    eligibleRoles: [shift.role],
    eligibleLevels: buildEligibleLevelsFromPriorityLevel(shift.priorityLevel),
    publishedAt: `${gig.date}T00:00:00.000Z`,
    operationsNote: shift.notes.trim() || gig.notes.trim() || getDefaultOperationsNote(shift.role),
    statusMessage: getDefaultStatusMessageForFeed(feed),
    imageUrl: gig.profileImageUrl,
    payRateLabel: payRateLabel ?? formatHourlyRateLabel(gig.country, 130),
    dressCode: "SCM uniform required",
  };
}

function buildDynamicOpenPass(
  gig: Gig,
  shift: Shift,
  payRateLabel?: string,
): StaffAppOpenPass | null {
  if (!isGigEligibleForOpenStaffAppPasses(gig)) {
    return null;
  }

  if (getShiftOpenSlots(shift) < 1) {
    return null;
  }

  return buildDynamicShiftPass(gig, shift, "open", payRateLabel);
}

function hydratePass(seed: StaffAppPassSeed, gigs: Gig[], shifts: Shift[]): StaffAppOpenPass | null {
  const gig = findGigById(gigs, seed.gigId);

  if (!gig) {
    return null;
  }

  const shift = findShiftById(shifts, seed.shiftId);
  const resolvedRole =
    shift && isStaffAppRole(shift.role) ? shift.role : seed.role;
  const resolvedEligibleCountry = shift ? gig.country : seed.eligibleCountry;
  const resolvedEligibleRegions = shift
    ? getEligiblePassRegions(gig.country, [gig.region])
    : getEligiblePassRegions(seed.eligibleCountry, seed.eligibleRegions);
  const resolvedEligibleLevels = shift
    ? buildEligibleLevelsFromPriorityLevel(shift.priorityLevel)
    : seed.eligibleLevels;

  return {
    id: seed.id,
    gigId: seed.gigId,
    shiftId: seed.shiftId,
    feed: seed.feed,
    artist: gig.artist,
    arena: gig.arena,
    city: gig.city,
    country: gig.country,
    region: gig.region,
    date: gig.date,
    startTime: shift?.startTime ?? seed.fallbackStartTime ?? gig.startTime,
    endTime: shift?.endTime ?? seed.fallbackEndTime ?? gig.endTime,
    role: resolvedRole,
    eligibleCountry: resolvedEligibleCountry,
    eligibleRegions: resolvedEligibleRegions,
    eligibleRoles: shift ? [resolvedRole] : seed.eligibleRoles,
    eligibleLevels: resolvedEligibleLevels,
    publishedAt: seed.publishedAt,
    operationsNote: seed.operationsNote,
    statusMessage: seed.statusMessage,
    imageUrl: gig.profileImageUrl,
    payRateLabel:
      seed.payRateLabel ?? formatHourlyRateLabel(resolvedEligibleCountry, 130),
    dressCode: seed.dressCode ?? "SCM uniform required",
  };
}

function isStaffAppRole(role: string): role is StaffAppRole {
  return role === "Seller" || role === "Stand Leader" || role === "Runner";
}

function buildEligibleLevelsFromPriorityLevel(
  priorityLevel: number,
): StaffAppLevel[] {
  const maxLevel = Math.min(5, Math.max(1, Math.round(priorityLevel)));
  return Array.from({ length: maxLevel }, (_, index) =>
    (index + 1) as StaffAppLevel,
  );
}

function resolveGigContactPerson(gig: Gig) {
  const merchRepresentative = gig.merchRepresentative.split(",")[0]?.trim() ?? "";

  return (
    gig.projectManager?.trim() ||
    gig.scmRepresentative?.trim() ||
    merchRepresentative ||
    "SCM team"
  );
}

function buildStaffAppScheduleId(staffId: string, shiftId: string) {
  return `schedule__${staffId}__${shiftId}`;
}

function buildStaffAppShiftThreadId(gigId: string, shiftId: string) {
  return `thread__shift__${gigId}__${shiftId}`;
}

function buildStaffAppAudienceThreadId(gigId: string, audience: string) {
  return `thread__audience__${gigId}__${audience}`;
}

function buildStaffAppGroupThreadId(gigId: string, groupId: string) {
  return `thread__group__${gigId}__${groupId}`;
}

function buildStaffAppDirectThreadId(gigId: string, staffId: string) {
  return `thread__direct__${gigId}__${staffId}`;
}

function buildStaffAppGigTeamThreadId(gigId: string) {
  return `thread__team__${gigId}`;
}

function buildStaffAppFallbackThreadId(messageId: string) {
  return `thread__message__${messageId}`;
}

function parseStaffAppShiftThreadId(threadId: string) {
  const parts = threadId.split("__");

  if (parts.length !== 4 || parts[0] !== "thread" || parts[1] !== "shift") {
    return null;
  }

  return {
    gigId: parts[2],
    shiftId: parts[3],
  };
}

function buildScheduledShiftEntry(
  staffId: string,
  gig: Gig,
  shift: Shift,
): StaffAppScheduledShift | null {
  if (!isStaffAppRole(shift.role)) {
    return null;
  }

  return {
    id: buildStaffAppScheduleId(staffId, shift.id),
    gigId: gig.id,
    shiftId: shift.id,
    artist: gig.artist,
    arena: gig.arena,
    city: gig.city,
    date: gig.date,
    startTime: shift.startTime || gig.startTime,
    endTime: shift.endTime || gig.endTime,
    role: shift.role,
    status: "Confirmed",
    meetingPoint: `Staff entrance at ${gig.arena}`,
    responsibleManager: resolveGigContactPerson(gig),
    practicalNotes: shift.notes.trim() || gig.notes.trim() || "No shift notes added yet.",
    imageUrl: gig.profileImageUrl,
    hasRelatedDocuments: false,
    threadId: buildStaffAppShiftThreadId(gig.id, shift.id),
  };
}

function createThreadFromScheduledShift(
  shift: StaffAppScheduledShift,
): StaffAppThreadAccumulator {
  return {
    id: shift.threadId ?? buildStaffAppShiftThreadId(shift.gigId, shift.shiftId ?? shift.id),
    shiftId: shift.id,
    gigId: shift.gigId,
    shiftTitle: `${shift.role} shift`,
    eventName: shift.artist,
    venue: `${shift.arena}, ${shift.city}`,
    date: shift.date,
    contactPerson: shift.responsibleManager,
    latestMessagePreview: "No messages yet.",
    unreadCount: 0,
    messages: [],
    sortTime: shift.startTime,
  };
}

function createThreadMessage(
  message: ShiftMessageRecord,
  fallbackAuthor: string,
  linkedStaffId: string,
): StaffAppMessageThread["messages"][number] {
  return {
    id: message.id,
    author: message.authorName?.trim() || fallbackAuthor,
    body: message.body,
    sentAt: message.createdAt,
    direction:
      message.authorType === "staff" &&
      message.authorProfileId?.trim() === linkedStaffId
        ? "outgoing"
        : "incoming",
    allowReplies: resolveShiftCommunicationThreadAllowReplies(message),
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      extension: attachment.extension,
      url: attachment.url,
    })),
  };
}

function buildThreadIdForMessage(message: ShiftMessageRecord, staffId: string) {
  const threadTarget = buildShiftCommunicationThreadTarget(message);

  if (threadTarget.id) {
    return threadTarget.id;
  }

  return buildStaffAppDirectThreadId(message.gigId, staffId);
}

function buildThreadTitle(
  message: ShiftMessageRecord,
  shift: Shift | null,
  groupName: string | null,
) {
  if (message.audience === "bookedOnShift") {
    if (shift && isStaffAppRole(shift.role)) {
      return `${shift.role} shift`;
    }

    return message.shiftId ? `${message.audienceLabel} shift` : "All booked staff";
  }

  if (message.audience === "standLeaders") {
    return "Stand leaders";
  }

  if (message.audience === "customGroup") {
    return groupName || message.audienceLabel || "Custom group";
  }

  if (message.audience === "individualPeople") {
    return message.recipientIds.length > 1 ? "Gig team" : "Direct update";
  }

  return message.audienceLabel || "Shift communication";
}

function ensureThreadAccumulator(
  threadMap: Map<string, StaffAppThreadAccumulator>,
  thread: StaffAppThreadAccumulator,
) {
  const existingThread = threadMap.get(thread.id);

  if (existingThread) {
    return existingThread;
  }

  threadMap.set(thread.id, thread);
  return thread;
}

function buildStaffAppMessagePreview(
  message: StaffAppMessageThread["messages"][number] | undefined,
) {
  if (!message) {
    return "No messages yet.";
  }

  const trimmedBody = message.body.trim();

  if (trimmedBody) {
    return trimmedBody;
  }

  if (message.attachments.length === 1) {
    return `Attachment: ${message.attachments[0]?.fileName ?? "1 file"}`;
  }

  if (message.attachments.length > 1) {
    return `${message.attachments.length} attachments`;
  }

  return "No messages yet.";
}

async function getStaffAppScheduleEntries(
  options: StaffAppScheduleOptions = {},
) {
  const { account, includePast = account === undefined } = options;
  const linkedStaffId = account?.linkedStaffProfileId?.trim() ?? "";
  const [gigs, shifts] = await Promise.all([getAllStoredGigs(), getAllStoredShifts()]);
  const gigsById = new Map(gigs.map((gig) => [gig.id, gig]));
  const today = getTodayInStockholm();

  let schedule = shifts
    .flatMap((shift) => {
      const gig = gigsById.get(shift.gigId);

      if (!gig || isGigMarkedNoMerch(gig)) {
        return [];
      }

      return shift.assignments
        .filter((assignment) => assignment.bookingStatus === "Confirmed")
        .filter((assignment) => !linkedStaffId || assignment.staffId === linkedStaffId)
        .map((assignment) => buildScheduledShiftEntry(assignment.staffId, gig, shift))
        .filter((entry): entry is StaffAppScheduledShift => Boolean(entry));
    })
    .sort(sortByUpcoming);

  if (!includePast) {
    schedule = schedule.filter((shift) => shift.date >= today);
  }

  if (!linkedStaffId) {
    return schedule;
  }

  const documents = await getStoredStaffDocuments(linkedStaffId);
  const documentShiftKeys = new Set(
    documents.map((document) => `${document.gigId}::${document.shiftId}`),
  );
  const documentGigIds = new Set(documents.map((document) => document.gigId));

  return schedule.map((shift) => ({
    ...shift,
    hasRelatedDocuments:
      documentGigIds.has(shift.gigId) ||
      (shift.shiftId ? documentShiftKeys.has(`${shift.gigId}::${shift.shiftId}`) : false),
  }));
}

async function getStaffAppMessageThreadsForAccount(
  account: StaffAppAccount,
  options: StaffAppMessageThreadOptions = {},
) {
  const linkedStaffId = account.linkedStaffProfileId?.trim() ?? "";

  if (!linkedStaffId) {
    return [] as StaffAppMessageThread[];
  }

  const {
    includePastSchedule = false,
    includeEmptyShiftThreads = true,
  } = options;
  const [gigs, shifts, communicationByGigId, schedule] = await Promise.all([
    getAllStoredGigs(),
    getAllStoredShifts(),
    getAllStoredShiftCommunicationStates(),
    getStaffAppScheduleEntries({
      account,
      includePast: includePastSchedule,
    }),
  ]);
  const gigsById = new Map(gigs.map((gig) => [gig.id, gig]));
  const shiftsById = new Map(shifts.map((shift) => [shift.id, shift]));
  const scheduleByUnderlyingShiftId = new Map(
    schedule
      .filter((shift) => shift.shiftId)
      .map((shift) => [shift.shiftId ?? "", shift]),
  );
  const threadMap = new Map<string, StaffAppThreadAccumulator>();

  if (includeEmptyShiftThreads) {
    schedule.forEach((shift) => {
      ensureThreadAccumulator(threadMap, createThreadFromScheduledShift(shift));
    });
  }

  Object.entries(communicationByGigId).forEach(([gigId, state]) => {
    const gig = gigsById.get(gigId);

    if (!gig) {
      return;
    }

    const groupNames = new Map(
      state.customGroups.map((group) => [group.id, group.name.trim()]),
    );

    state.messages
      .filter((message) => message.recipientIds.includes(linkedStaffId))
      .forEach((message) => {
        const linkedShift = message.shiftId ? shiftsById.get(message.shiftId) ?? null : null;
        const scheduledShift = message.shiftId
          ? scheduleByUnderlyingShiftId.get(message.shiftId) ?? null
          : null;
        const threadId = buildThreadIdForMessage(message, linkedStaffId);
        const defaultContactPerson = resolveGigContactPerson(gig);
        const thread = ensureThreadAccumulator(threadMap, {
          id: threadId,
          shiftId: scheduledShift?.id ?? message.shiftId ?? threadId,
          gigId: gig.id,
          shiftTitle: buildThreadTitle(
            message,
            linkedShift,
            message.groupId ? groupNames.get(message.groupId) ?? null : null,
          ),
          eventName: gig.artist,
          venue: `${gig.arena}, ${gig.city}`,
          date: gig.date,
          contactPerson: defaultContactPerson,
          latestMessagePreview: "No messages yet.",
          unreadCount: 0,
          messages: [],
          sortTime: linkedShift?.startTime ?? gig.startTime,
        });

        thread.messages.push(
          createThreadMessage(message, defaultContactPerson, linkedStaffId),
        );
        thread.lastActivityAt =
          !thread.lastActivityAt ||
          new Date(message.createdAt).getTime() > new Date(thread.lastActivityAt).getTime()
            ? message.createdAt
            : thread.lastActivityAt;
        thread.contactPerson =
          message.authorName?.trim() || scheduledShift?.responsibleManager || defaultContactPerson;
      });
  });

  const threads = [...threadMap.values()]
    .sort((left, right) => {
      const leftHasMessages = left.messages.length > 0;
      const rightHasMessages = right.messages.length > 0;

      if (leftHasMessages !== rightHasMessages) {
        return rightHasMessages ? 1 : -1;
      }

      if (leftHasMessages && rightHasMessages) {
        return (
          new Date(right.lastActivityAt ?? 0).getTime() -
          new Date(left.lastActivityAt ?? 0).getTime()
        );
      }

      return (
        getGigDateTime(left.date, left.sortTime).getTime() -
        getGigDateTime(right.date, right.sortTime).getTime()
      );
    })
    .map<StaffAppMessageThread>((thread) => {
      const sortedMessages = [...thread.messages].sort(
        (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime(),
      );
      const latestMessage = sortedMessages.at(-1);

      return {
        id: thread.id,
        shiftId: thread.shiftId,
        gigId: thread.gigId,
        shiftTitle: thread.shiftTitle,
        eventName: thread.eventName,
        venue: thread.venue,
        date: thread.date,
        contactPerson: thread.contactPerson,
        latestMessagePreview: buildStaffAppMessagePreview(latestMessage),
        unreadCount: 0,
        messages: sortedMessages,
      };
    });

  return threads;
}

function isUserEligibleForPass(account: StaffAppAccount, pass: StaffAppOpenPass) {
  if (account.country !== pass.eligibleCountry) {
    return false;
  }

  if (
    shouldRestrictPassesToRegion(pass.eligibleCountry) &&
    pass.eligibleRegions.length > 0 &&
    !pass.eligibleRegions.some(
      (region) => normalizeRegion(region) === normalizeRegion(account.region),
    )
  ) {
    return false;
  }

  return pass.eligibleRoles.some((role) => {
    const roleLevel = getStaffAppLevelForRole(account.roleScopes, role);

    if (roleLevel === null) {
      return false;
    }

    return pass.eligibleLevels.includes(roleLevel);
  });
}

async function getStaticStaffAppPasses(feeds?: StaffAppPassFeed[]) {
  const [gigs, shifts] = await Promise.all([getAllStoredGigs(), getAllStoredShifts()]);
  const requestedFeeds = feeds ? new Set(feeds) : null;

  return passSeeds
    .filter((seed) => (requestedFeeds ? requestedFeeds.has(seed.feed) : true))
    .map((seed) => hydratePass(seed, gigs, shifts))
    .filter((pass): pass is StaffAppOpenPass => Boolean(pass))
    .sort(sortByUpcoming);
}

async function getDynamicOpenStaffAppPasses(account?: StaffAppAccount) {
  const [{ defaultHourlyRates, linkedStaffProfile }, gigs, shifts] = await Promise.all([
    getPassCompensationContext(account),
    getAllStoredGigs(),
    getAllStoredShifts(),
  ]);
  const gigsById = new Map(gigs.map((gig) => [gig.id, gig]));
  const today = getTodayInStockholm();
  const linkedStaffProfileId = account?.linkedStaffProfileId?.trim() ?? "";

  return shifts
    .flatMap((shift) => {
      const gig = gigsById.get(shift.gigId);

      if (!gig) {
        return [];
      }

      if (!isStaffAppRole(shift.role)) {
        return [];
      }

      if (
        linkedStaffProfileId &&
        shift.assignments.some((assignment) => assignment.staffId === linkedStaffProfileId)
      ) {
        return [];
      }

      const payRateLabel = getEffectivePayRateLabel({
        country: account?.country ?? gig.country,
        role: shift.role,
        defaultHourlyRates,
        roleProfiles: linkedStaffProfile?.roleProfiles,
      });
      const pass = buildDynamicOpenPass(gig, shift, payRateLabel);
      return pass ? [pass] : [];
    })
    .filter((pass) => pass.date >= today)
    .filter((pass) => !account || isUserEligibleForPass(account, pass))
    .sort(sortByUpcoming);
}

async function getDynamicAssignedStaffAppPasses(
  account: StaffAppAccount,
  bookingStatus: "Waitlisted" | "Pending",
  feed: Extract<StaffAppPassFeed, "standby" | "unassigned">,
) {
  const linkedStaffProfileId = account.linkedStaffProfileId?.trim() ?? "";

  if (!linkedStaffProfileId) {
    return [] as StaffAppOpenPass[];
  }

  const [{ defaultHourlyRates, linkedStaffProfile }, gigs, shifts] = await Promise.all([
    getPassCompensationContext(account),
    getAllStoredGigs(),
    getAllStoredShifts(),
  ]);
  const gigsById = new Map(gigs.map((gig) => [gig.id, gig]));
  const today = getTodayInStockholm();

  return shifts
    .flatMap((shift) => {
      const matchingAssignment = shift.assignments.find(
        (assignment) =>
          assignment.staffId === linkedStaffProfileId &&
          assignment.bookingStatus === bookingStatus,
      );

      if (!matchingAssignment) {
        return [];
      }

      const gig = gigsById.get(shift.gigId);

      if (!gig) {
        return [];
      }

      if (!isStaffAppRole(shift.role)) {
        return [];
      }

      const payRateLabel =
        getAssignmentPayRateLabel(matchingAssignment) ??
        getEffectivePayRateLabel({
          country: account.country,
          role: shift.role,
          defaultHourlyRates,
          roleProfiles: linkedStaffProfile?.roleProfiles,
        });
      const pass = buildDynamicShiftPass(gig, shift, feed, payRateLabel);
      return pass ? [pass] : [];
    })
    .filter((pass) => pass.date >= today)
    .sort(sortByUpcoming);
}

async function getEligibleStaffAppPasses(account: StaffAppAccount) {
  const [openPasses, standbyPasses, unassignedPasses] = await Promise.all([
    getDynamicOpenStaffAppPasses(account),
    getDynamicAssignedStaffAppPasses(account, "Waitlisted", "standby"),
    getDynamicAssignedStaffAppPasses(account, "Pending", "unassigned"),
  ]);

  return [...openPasses, ...standbyPasses, ...unassignedPasses].sort(sortByUpcoming);
}

export async function getStaffAppOpenPasses(account: StaffAppAccount) {
  return getDynamicOpenStaffAppPasses(account);
}

export async function getStaffAppOpenPassesForShift(shiftId: string) {
  const [compensationSettings, gigs, shifts] = await Promise.all([
    getSystemCompensationSettings(),
    getAllStoredGigs(),
    getAllStoredShifts(),
  ]);
  const gigById = new Map(gigs.map((gig) => [gig.id, gig]));
  const shift = shifts.find((currentShift) => currentShift.id === shiftId);

  if (!shift) {
    return [] as StaffAppOpenPass[];
  }

  const gig = gigById.get(shift.gigId);

  if (!gig || !isGigEligibleForOpenStaffAppPasses(gig)) {
    return [] as StaffAppOpenPass[];
  }

  if (!isStaffAppRole(shift.role)) {
    return [] as StaffAppOpenPass[];
  }

  const pass = buildDynamicShiftPass(
    gig,
    shift,
    "open",
    getEffectivePayRateLabel({
      country: gig.country,
      role: shift.role,
      defaultHourlyRates: compensationSettings.defaultHourlyRates,
    }),
  );
  return pass ? [pass] : [];
}

export async function getStaffAppStandbyPasses(account: StaffAppAccount) {
  return getDynamicAssignedStaffAppPasses(account, "Waitlisted", "standby");
}

export async function getStaffAppUnassignedPasses(account: StaffAppAccount) {
  return getDynamicAssignedStaffAppPasses(account, "Pending", "unassigned");
}

export async function getStaffAppGigPassById(account: StaffAppAccount, passId: string) {
  const [dynamicPasses, staticPasses] = await Promise.all([
    getEligibleStaffAppPasses(account),
    getStaticStaffAppPasses(),
  ]);

  return (
    dynamicPasses.find((pass) => pass.id === passId) ??
    staticPasses.find((pass) => pass.id === passId && isUserEligibleForPass(account, pass)) ??
    null
  );
}

export async function getStaffAppManagedGigs(account: StaffAppAccount) {
  const linkedStaffProfileId = account.linkedStaffProfileId?.trim() ?? "";

  if (!linkedStaffProfileId) {
    return [] as StaffAppManagedGig[];
  }

  const gigs = await getVisibleTemporaryGigManagerGigsForStaffProfile(linkedStaffProfileId);

  return gigs
    .map<StaffAppManagedGig>((gig) => {
      const timeline = getGigTemporaryManagerTimeline(gig.date);

      return {
        id: `managed-${gig.id}`,
        gigId: gig.id,
        artist: gig.artist,
        arena: gig.arena,
        city: gig.city,
        country: gig.country,
        region: gig.region,
        date: gig.date,
        startTime: gig.startTime,
        endTime: gig.endTime,
        imageUrl: gig.profileImageUrl,
        statusMessage: timeline.isPlatformAccessible
          ? "Temporary Gig Manager access is active for this gig."
          : "Gig info remains visible here until the one-week follow-up window ends.",
        accessEndsOn: timeline.platformAccessEndsOn,
        visibleUntil: timeline.visibleUntil,
      };
    })
    .sort(sortByUpcoming);
}

export async function getStaffAppGigOverview(account: StaffAppAccount) {
  const [passes, managedGigs] = await Promise.all([
    getEligibleStaffAppPasses(account),
    getStaffAppManagedGigs(account),
  ]);

  return {
    managedGigs,
    openPasses: passes.filter((pass) => pass.feed === "open"),
    standbyPasses: passes.filter((pass) => pass.feed === "standby"),
    unassignedPasses: passes.filter((pass) => pass.feed === "unassigned"),
  };
}

export async function getStaffAppSchedule(account?: StaffAppAccount) {
  return getStaffAppScheduleEntries({ account });
}

export async function getStaffAppShiftById(
  shiftId: string,
  account?: StaffAppAccount,
) {
  const schedule = await getStaffAppScheduleEntries({
    account,
    includePast: true,
  });
  return schedule.find((shift) => shift.id === shiftId) ?? null;
}

export async function getStaffAppMessageThreads(account: StaffAppAccount) {
  return getStaffAppMessageThreadsForAccount(account);
}

export async function getStaffAppMessageThreadById(
  threadId: string,
  account: StaffAppAccount,
) {
  const threads = await getStaffAppMessageThreadsForAccount(account, {
    includePastSchedule: true,
    includeEmptyShiftThreads: true,
  });
  const matchedThread = threads.find((thread) => thread.id === threadId) ?? null;

  if (matchedThread) {
    return matchedThread;
  }

  const parsedThread = parseStaffAppShiftThreadId(threadId);

  if (!parsedThread) {
    return null;
  }

  const scheduledShift = (
    await getStaffAppScheduleEntries({
      account,
      includePast: true,
    })
  ).find((shift) => shift.gigId === parsedThread.gigId && shift.shiftId === parsedThread.shiftId);

  return scheduledShift ? createThreadFromScheduledShift(scheduledShift) : null;
}

export async function getStaffAppDocuments(account: StaffAppAccount) {
  const linkedStaffId = account.linkedStaffProfileId;
  const payslips = await getStaffAppPayrollSnapshots(account);

  if (!linkedStaffId) {
    return {
      employmentContracts: [] as StaffAppDocumentLink[],
      timeReports: [] as StaffAppDocumentLink[],
      payslips,
    };
  }

  const documents = await getStoredStaffDocuments(linkedStaffId);
  const links = documents.map<StaffAppDocumentLink>((document) => ({
    id: document.id,
    title: document.gigName,
    venue: formatDate(document.gigDate),
    date: document.gigDate,
    role: document.shiftRole,
    kind: document.documentKind,
    href: `/api/staff/${linkedStaffId}/documents/${document.id}`,
  }));

  return {
    employmentContracts: links.filter((document) => document.kind === "Employment Contract"),
    timeReports: links.filter((document) => document.kind === "Time Report"),
    payslips,
  };
}

export async function getStaffAppRecentDocuments(account: StaffAppAccount) {
  const documents = await getStaffAppDocuments(account);

  return [...documents.employmentContracts, ...documents.timeReports]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 3);
}

export async function getStaffAppColleagues(account: StaffAppAccount) {
  const staffProfiles = await getAllStoredStaffProfiles();

  return staffProfiles
    .filter((profile) => profile.approvalStatus === "Approved")
    .filter((profile) => profile.country === account.country)
    .filter((profile) => normalizeRegion(profile.region) === normalizeRegion(account.region))
    .filter((profile) => profile.id !== account.linkedStaffProfileId)
    .map<StaffAppColleague>((profile) => ({
      id: profile.id,
      fullName: `${profile.firstName} ${profile.lastName}`,
      phone: profile.phone,
      email: profile.email,
      country: profile.country,
      role: profile.roles.join(" / "),
      region: profile.region,
      profileImageUrl: profile.profileImageUrl,
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function getStaffAppColleagueById(account: StaffAppAccount, colleagueId: string) {
  const colleagues = await getStaffAppColleagues(account);
  return colleagues.find((colleague) => colleague.id === colleagueId) ?? null;
}

export async function getStaffAppHomeOverview(account: StaffAppAccount) {
  const [managedGigs, openPasses, schedule, threads, documents] = await Promise.all([
    getStaffAppManagedGigs(account),
    getStaffAppOpenPasses(account),
    getStaffAppSchedule(account),
    getStaffAppMessageThreads(account),
    getStaffAppRecentDocuments(account),
  ]);

  return {
    managedGigCount: managedGigs.length,
    openPasses,
    openPassesCount: openPasses.length,
    upcomingShiftCount: schedule.length,
    unreadMessageCount: threads.reduce((count, thread) => count + thread.messages.length, 0),
    recentDocumentCount: documents.length,
    nextShift: schedule[0] ?? null,
    recentDocuments: documents,
  };
}

export function getStaffAppInitials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatStaffAppDate(value: string) {
  return formatDate(value);
}

export function formatStaffAppCompactDate(value: string) {
  return formatDate(value, { day: "numeric", month: "short" });
}

export function formatStaffAppDateLine(date: string, startTime: string, endTime: string) {
  return `${formatStaffAppDate(date)} · ${startTime} - ${endTime}`;
}

export function formatStaffAppTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
