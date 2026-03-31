import { getStoredGigTimeReportShifts } from "@/lib/gig-time-report-store";
import {
  buildShiftCommunicationMessagePreview,
  buildShiftCommunicationThreadSummaries,
} from "@/lib/shift-communication-threads";
import { getAvailableStaffProfilesForShift } from "@/lib/shift-store";
import { getStoredShiftCommunication } from "@/lib/shift-communication-store";
import { getAllStoredStaffProfiles, type StoredStaffProfile } from "@/lib/staff-store";
import { getStaffAppScmData } from "@/lib/staff-app-scm-data";
import type {
  Assignment,
  Gig,
  Shift,
  ShiftMessageAudience,
  ShiftMessageRecord,
} from "@/types/scm";
import type { StoredScmStaffProfile } from "@/types/scm-rbac";

type StockholmNowSnapshot = {
  dateKey: string;
  timeKey: string;
};

type LiveStatusTone = "neutral" | "success" | "warn" | "danger";

export type StaffAppScmGigOperationalStatus = "live" | "upcoming" | "finished";

export type StaffAppScmGigCard = {
  id: string;
  artist: string;
  arena: string;
  city: string;
  country: string;
  date: string;
  startTime: string;
  endTime: string;
  gigStatus: string;
  operationalStatus: StaffAppScmGigOperationalStatus;
  operationalStatusLabel: string;
  checkedInCount: number;
  plannedCount: number;
  confirmedCount: number;
  onSiteCount: number;
  completedCount: number;
  understaffedShiftCount: number;
  fullShiftCount: number;
  totalShiftCount: number;
  lateCount: number;
  pendingCount: number;
  alertCount: number;
  requiresAttention: boolean;
  summary: string;
};

export type StaffAppScmShiftCard = {
  id: string;
  role: string;
  startTime: string;
  endTime: string;
  plannedCount: number;
  confirmedCount: number;
  onSiteCount: number;
  completedCount: number;
  pendingCount: number;
  lateCount: number;
  gapCount: number;
  isFullyStaffed: boolean;
  requiresAttention: boolean;
  shiftStatus: StaffAppScmGigOperationalStatus;
  shiftStatusLabel: string;
  summary: string;
};

export type StaffAppScmRosterStatus =
  | "checkedIn"
  | "checkedOut"
  | "late"
  | "awaitingCheckIn"
  | "upcoming"
  | "pending"
  | "waitlisted"
  | "missing";

export type StaffAppScmRosterEntry = {
  id: string;
  shiftId: string;
  shiftRole: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  staffPhone: string;
  staffProfileImageUrl?: string;
  bookingStatus: Assignment["bookingStatus"];
  checkedIn?: string;
  checkedOut?: string;
  status: StaffAppScmRosterStatus;
  statusLabel: string;
  tone: LiveStatusTone;
  shiftStartTime: string;
  shiftEndTime: string;
  workedTimeLabel?: string;
};

export type StaffAppScmMessagePreview = {
  id: string;
  body: string;
  audienceLabel: string;
  createdAt: string;
};

export type StaffAppScmConversationMessage = {
  id: string;
  author: string;
  body: string;
  sentAt: string;
  direction: "incoming" | "outgoing";
  allowReplies: boolean;
  attachments: NonNullable<ShiftMessageRecord["attachments"]>;
};

export type StaffAppScmConversationThread = {
  id: string;
  gigId: string;
  title: string;
  audience: ShiftMessageAudience;
  audienceLabel: string;
  recipientIds: string[];
  shiftId?: string;
  groupId?: string;
  preview: string;
  lastActivityAt: string;
  recipientCount: number;
  messageCount: number;
  allowReplies: boolean;
  messages: StaffAppScmConversationMessage[];
};

export type StaffAppScmFileEntry = {
  id: string;
  fileName: string;
  url: string;
  section: "files" | "reports";
  folderName?: string;
  uploadedAt: string;
  extension: string;
  fileSize: number;
};

export type StaffAppScmGigWorkspace = {
  gig: Gig;
  roleLabel: string;
  operationalStatus: StaffAppScmGigOperationalStatus;
  operationalStatusLabel: string;
  timelineLabel: string;
  summary: {
    checkedInCount: number;
    plannedCount: number;
    confirmedCount: number;
    fullShiftCount: number;
    totalShiftCount: number;
    understaffedShiftCount: number;
    lateCount: number;
    pendingCount: number;
    deviationCount: number;
    approvedTimeReportCount: number;
    correctableTimeEntryCount: number;
  };
  quickActionTargetShiftId: string | null;
  shifts: StaffAppScmShiftCard[];
  roster: StaffAppScmRosterEntry[];
  files: StaffAppScmFileEntry[];
  recentMessages: StaffAppScmMessagePreview[];
};

export type StaffAppScmShiftWorkspace = {
  gig: Gig;
  shift: Shift;
  roleLabel: string;
  gigStatusLabel: string;
  shiftStatusLabel: string;
  confirmedCount: number;
  pendingCount: number;
  waitlistCount: number;
  gapCount: number;
  lateCount: number;
  roster: StaffAppScmRosterEntry[];
  availableStaff: Array<{
    id: string;
    displayName: string;
    roleLabel: string;
    regionLabel: string;
  }>;
};

export type StaffAppScmOperationsBoard = {
  roleLabel: string;
  scopeLabel: string;
  primaryGigId: string | null;
  liveGigCount: number;
  todayGigCount: number;
  requiresAttentionCount: number;
  gigCards: StaffAppScmGigCard[];
};

function getStockholmNowSnapshot(): StockholmNowSnapshot {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    dateKey: `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`,
    timeKey: `${valueByType.get("hour")}:${valueByType.get("minute")}`,
  };
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  const normalizedHours = Number.isFinite(hours) ? hours : 0;
  const normalizedMinutes = Number.isFinite(minutes) ? minutes : 0;
  return normalizedHours * 60 + normalizedMinutes;
}

function formatMinutesAsTime(totalMinutes: number) {
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutesToTime(value: string, offsetMinutes: number) {
  return formatMinutesAsTime(parseTimeToMinutes(value) + offsetMinutes);
}

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getConfirmedAssignments(shift: Shift) {
  return shift.assignments.filter((assignment) => assignment.bookingStatus === "Confirmed");
}

function compareShiftTimes(left: Shift, right: Shift) {
  if (left.startTime !== right.startTime) {
    return left.startTime.localeCompare(right.startTime);
  }

  if (left.endTime !== right.endTime) {
    return left.endTime.localeCompare(right.endTime);
  }

  return left.role.localeCompare(right.role);
}

function sortShiftsChronologically(shifts: Shift[]) {
  return [...shifts].sort(compareShiftTimes);
}

function getPendingAssignments(shift: Shift) {
  return shift.assignments.filter((assignment) => assignment.bookingStatus === "Pending");
}

function getWaitlistedAssignments(shift: Shift) {
  return shift.assignments.filter((assignment) => assignment.bookingStatus === "Waitlisted");
}

function getCheckedInAssignments(shift: Shift) {
  return getConfirmedAssignments(shift).filter(
    (assignment) => hasValue(assignment.checkedIn) && !hasValue(assignment.checkedOut),
  );
}

function getCheckedOutAssignments(shift: Shift) {
  return getConfirmedAssignments(shift).filter((assignment) => hasValue(assignment.checkedOut));
}

function getGigOperationWindow(gig: Gig, shifts: Shift[]) {
  if (shifts.length === 0) {
    return {
      startTime: gig.startTime || "00:00",
      endTime: gig.endTime || "23:59",
    };
  }

  const earliestShift = [...shifts].sort(
    (left, right) => parseTimeToMinutes(left.startTime) - parseTimeToMinutes(right.startTime),
  )[0];
  const latestShift = [...shifts].sort(
    (left, right) => parseTimeToMinutes(left.endTime) - parseTimeToMinutes(right.endTime),
  ).at(-1);

  return {
    startTime: earliestShift?.startTime ?? gig.startTime ?? "00:00",
    endTime: latestShift?.endTime ?? gig.endTime ?? "23:59",
  };
}

function getOperationalStatusLabel(status: StaffAppScmGigOperationalStatus) {
  if (status === "live") {
    return "Live";
  }

  if (status === "finished") {
    return "Finished";
  }

  return "Upcoming";
}

function resolveGigOperationalStatus(
  gig: Gig,
  shifts: Shift[],
  now: StockholmNowSnapshot,
): StaffAppScmGigOperationalStatus {
  const window = getGigOperationWindow(gig, shifts);

  if (gig.date > now.dateKey) {
    return "upcoming";
  }

  if (gig.date < now.dateKey) {
    return "finished";
  }

  if (now.timeKey < window.startTime) {
    return "upcoming";
  }

  if (now.timeKey > window.endTime) {
    return "finished";
  }

  return "live";
}

function resolveShiftOperationalStatus(
  gigStatus: StaffAppScmGigOperationalStatus,
  shift: Shift,
  gigDate: string,
  now: StockholmNowSnapshot,
): StaffAppScmGigOperationalStatus {
  if (gigDate > now.dateKey) {
    return "upcoming";
  }

  if (gigDate < now.dateKey) {
    return "finished";
  }

  if (gigStatus === "upcoming") {
    return "upcoming";
  }

  if (gigStatus === "finished") {
    return "finished";
  }

  if (now.timeKey < shift.startTime) {
    return "upcoming";
  }

  if (now.timeKey > shift.endTime) {
    return "finished";
  }

  return "live";
}

function getLateAssignments(
  shift: Shift,
  shiftStatus: StaffAppScmGigOperationalStatus,
  now: StockholmNowSnapshot,
) {
  const lateThreshold = addMinutesToTime(shift.startTime, 15);

  return getConfirmedAssignments(shift).filter(
    (assignment) =>
      shiftStatus === "live" &&
      now.timeKey > lateThreshold &&
      !hasValue(assignment.checkedIn) &&
      !hasValue(assignment.checkedOut),
  );
}

function formatWorkedTimeLabel(checkedIn: string | undefined, checkedOut: string | undefined) {
  if (!hasValue(checkedIn)) {
    return undefined;
  }

  const checkedInValue = checkedIn;
  const start = new Date(checkedInValue);

  if (Number.isNaN(start.getTime())) {
    return undefined;
  }

  const end = hasValue(checkedOut) ? new Date(checkedOut) : new Date();

  if (Number.isNaN(end.getTime())) {
    return undefined;
  }

  const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function getRosterStatusMeta(status: StaffAppScmRosterStatus) {
  switch (status) {
    case "checkedIn":
      return { label: "Checked in", tone: "success" as const };
    case "checkedOut":
      return { label: "Checked out", tone: "neutral" as const };
    case "late":
      return { label: "Late", tone: "danger" as const };
    case "awaitingCheckIn":
      return { label: "Awaiting check-in", tone: "warn" as const };
    case "upcoming":
      return { label: "Booked", tone: "neutral" as const };
    case "pending":
      return { label: "Pending", tone: "warn" as const };
    case "waitlisted":
      return { label: "Waitlist", tone: "neutral" as const };
    case "missing":
      return { label: "Missing", tone: "danger" as const };
    default:
      return { label: "Status", tone: "neutral" as const };
  }
}

function resolveRosterStatus(
  assignment: Assignment,
  shift: Shift,
  shiftStatus: StaffAppScmGigOperationalStatus,
  now: StockholmNowSnapshot,
): StaffAppScmRosterStatus {
  if (assignment.bookingStatus === "Waitlisted") {
    return "waitlisted";
  }

  if (assignment.bookingStatus === "Pending") {
    return "pending";
  }

  if (hasValue(assignment.checkedOut)) {
    return "checkedOut";
  }

  if (hasValue(assignment.checkedIn)) {
    return "checkedIn";
  }

  if (shiftStatus === "finished") {
    return "missing";
  }

  if (shiftStatus === "live" && now.timeKey > addMinutesToTime(shift.startTime, 15)) {
    return "late";
  }

  if (shiftStatus === "live") {
    return "awaitingCheckIn";
  }

  return "upcoming";
}

function buildShiftCard(
  shift: Shift,
  gigStatus: StaffAppScmGigOperationalStatus,
  gigDate: string,
  now: StockholmNowSnapshot,
): StaffAppScmShiftCard {
  const shiftStatus = resolveShiftOperationalStatus(gigStatus, shift, gigDate, now);
  const confirmedCount = getConfirmedAssignments(shift).length;
  const pendingCount = getPendingAssignments(shift).length;
  const onSiteCount = getCheckedInAssignments(shift).length;
  const completedCount = getCheckedOutAssignments(shift).length;
  const lateCount = getLateAssignments(shift, shiftStatus, now).length;
  const gapCount = Math.max(shift.requiredStaff - confirmedCount, 0);
  const isFullyStaffed = gapCount === 0;

  return {
    id: shift.id,
    role: shift.role,
    startTime: shift.startTime,
    endTime: shift.endTime,
    plannedCount: shift.requiredStaff,
    confirmedCount,
    onSiteCount,
    completedCount,
    pendingCount,
    lateCount,
    gapCount,
    isFullyStaffed,
    requiresAttention: gapCount > 0 || lateCount > 0 || pendingCount > 0,
    shiftStatus,
    shiftStatusLabel: getOperationalStatusLabel(shiftStatus),
    summary: `${onSiteCount}/${shift.requiredStaff} on site${gapCount > 0 ? ` | ${gapCount} missing` : ""}${lateCount > 0 ? ` | ${lateCount} late` : ""}`,
  };
}

function buildRosterEntries(
  shifts: Shift[],
  gigStatus: StaffAppScmGigOperationalStatus,
  gigDate: string,
  staffProfileById: Map<string, StoredStaffProfile>,
  now: StockholmNowSnapshot,
) {
  return shifts
    .flatMap((shift) => {
      const shiftStatus = resolveShiftOperationalStatus(gigStatus, shift, gigDate, now);

      return shift.assignments.map((assignment) => {
        const staffProfile = staffProfileById.get(assignment.staffId);
        const status = resolveRosterStatus(assignment, shift, shiftStatus, now);
        const statusMeta = getRosterStatusMeta(status);

        return {
          id: `${shift.id}:${assignment.staffId}`,
          shiftId: shift.id,
          shiftRole: shift.role,
          staffId: assignment.staffId,
          staffName: staffProfile?.displayName ?? "Unknown staff member",
          staffEmail: staffProfile?.email ?? "",
          staffPhone: staffProfile?.phone ?? "",
          staffProfileImageUrl: staffProfile?.profileImageUrl ?? "",
          bookingStatus: assignment.bookingStatus,
          checkedIn: assignment.checkedIn,
          checkedOut: assignment.checkedOut,
          status,
          statusLabel: statusMeta.label,
          tone: statusMeta.tone,
          shiftStartTime: shift.startTime,
          shiftEndTime: shift.endTime,
          workedTimeLabel: formatWorkedTimeLabel(assignment.checkedIn, assignment.checkedOut),
        } satisfies StaffAppScmRosterEntry;
      });
    })
    .sort((left, right) => {
      if (left.shiftStartTime !== right.shiftStartTime) {
        return left.shiftStartTime.localeCompare(right.shiftStartTime);
      }

      if (left.shiftRole !== right.shiftRole) {
        return left.shiftRole.localeCompare(right.shiftRole);
      }

      return left.staffName.localeCompare(right.staffName);
    });
}

function buildScmConversationTitle(
  thread: {
    audience: ShiftMessageRecord["audience"];
    audienceLabel: string;
    recipientIds: string[];
    shiftId?: string;
    groupId?: string;
  },
  shifts: Shift[],
  staffProfileById: Map<string, StoredStaffProfile>,
  groupNameById: Map<string, string>,
) {
  if (thread.audience === "bookedOnShift") {
    const linkedShift = thread.shiftId
      ? shifts.find((shift) => shift.id === thread.shiftId) ?? null
      : null;

    return linkedShift ? `${linkedShift.role} shift` : "All booked staff";
  }

  if (thread.audience === "standLeaders") {
    return "Stand leaders";
  }

  if (thread.audience === "customGroup") {
    return (
      (thread.groupId ? groupNameById.get(thread.groupId) : null) ??
      thread.audienceLabel
    );
  }

  if (thread.audience === "individualPeople" && thread.recipientIds.length === 1) {
    return (
      staffProfileById.get(thread.recipientIds[0] ?? "")?.displayName ??
      thread.audienceLabel
    );
  }

  return thread.audienceLabel;
}

function getCardSortWeight(card: StaffAppScmGigCard, today: string) {
  if (card.operationalStatus === "live") {
    return 0;
  }

  if (card.date === today && card.operationalStatus === "upcoming") {
    return 1;
  }

  if (card.operationalStatus === "upcoming") {
    return 2;
  }

  return 3;
}

async function buildGigCard(gig: Gig, now: StockholmNowSnapshot) {
  const shifts = await getStoredGigTimeReportShifts(gig.id);
  const operationalStatus = resolveGigOperationalStatus(gig, shifts, now);
  const shiftCards = shifts.map((shift) => buildShiftCard(shift, operationalStatus, gig.date, now));
  const checkedInCount = shiftCards.reduce((count, shift) => count + shift.onSiteCount, 0);
  const plannedCount = shiftCards.reduce((count, shift) => count + shift.plannedCount, 0);
  const confirmedCount = shiftCards.reduce((count, shift) => count + shift.confirmedCount, 0);
  const onSiteCount = shiftCards.reduce((count, shift) => count + shift.onSiteCount, 0);
  const completedCount = shiftCards.reduce((count, shift) => count + shift.completedCount, 0);
  const understaffedShiftCount = shiftCards.filter((shift) => shift.gapCount > 0).length;
  const fullShiftCount = shiftCards.filter((shift) => shift.isFullyStaffed).length;
  const lateCount = shiftCards.reduce((count, shift) => count + shift.lateCount, 0);
  const pendingCount = shiftCards.reduce((count, shift) => count + shift.pendingCount, 0);

  return {
    id: gig.id,
    artist: gig.artist,
    arena: gig.arena,
    city: gig.city,
    country: gig.country,
    date: gig.date,
    startTime: gig.startTime,
    endTime: gig.endTime,
    gigStatus: gig.status,
    operationalStatus,
    operationalStatusLabel: getOperationalStatusLabel(operationalStatus),
    checkedInCount,
    plannedCount,
    confirmedCount,
    onSiteCount,
    completedCount,
    understaffedShiftCount,
    fullShiftCount,
    totalShiftCount: shiftCards.length,
    lateCount,
    pendingCount,
    alertCount: gig.alertCount,
    requiresAttention:
      gig.alertCount > 0 || lateCount > 0 || understaffedShiftCount > 0 || pendingCount > 0,
    summary:
      operationalStatus === "live"
        ? `${checkedInCount}/${plannedCount} checked in | ${understaffedShiftCount} shifts need staffing`
        : `${confirmedCount}/${plannedCount} booked | ${lateCount} late | ${gig.alertCount} alerts`,
  } satisfies StaffAppScmGigCard;
}

function selectPrimaryGigId(cards: StaffAppScmGigCard[], today: string) {
  const sortedCards = [...cards].sort((left, right) => {
    const weightDifference = getCardSortWeight(left, today) - getCardSortWeight(right, today);

    if (weightDifference !== 0) {
      return weightDifference;
    }

    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.startTime.localeCompare(right.startTime);
  });

  return sortedCards[0]?.id ?? null;
}

function getTimelineLabel(gig: Gig, shifts: Shift[]) {
  const window = getGigOperationWindow(gig, shifts);
  return `${gig.date} | ${window.startTime} - ${window.endTime}`;
}

export async function getStaffAppScmOperationsBoard(profile: StoredScmStaffProfile) {
  const scmData = await getStaffAppScmData(profile);
  const now = getStockholmNowSnapshot();
  const gigCards = await Promise.all(
    scmData.accessibleGigs.map((gig) => buildGigCard(gig, now)),
  );
  const sortedCards = [...gigCards].sort((left, right) => {
    const weightDifference =
      getCardSortWeight(left, now.dateKey) - getCardSortWeight(right, now.dateKey);

    if (weightDifference !== 0) {
      return weightDifference;
    }

    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.startTime.localeCompare(right.startTime);
  });

  return {
    roleLabel: scmData.roleDefinition.label,
    scopeLabel: scmData.scopeLabel,
    primaryGigId: selectPrimaryGigId(sortedCards, now.dateKey),
    liveGigCount: sortedCards.filter((card) => card.operationalStatus === "live").length,
    todayGigCount: sortedCards.filter((card) => card.date === now.dateKey).length,
    requiresAttentionCount: sortedCards.filter((card) => card.requiresAttention).length,
    gigCards: sortedCards,
  } satisfies StaffAppScmOperationsBoard;
}

export async function getStaffAppScmGigWorkspace(
  profile: StoredScmStaffProfile,
  gigId: string,
) {
  const scmData = await getStaffAppScmData(profile);
  const gig = scmData.accessibleGigs.find((candidate) => candidate.id === gigId) ?? null;

  if (!gig) {
    return null;
  }

  const now = getStockholmNowSnapshot();
  const [shifts, staffProfiles, communication] = await Promise.all([
    getStoredGigTimeReportShifts(gig.id),
    getAllStoredStaffProfiles(),
    getStoredShiftCommunication(gig.id),
  ]);
  const sortedShifts = sortShiftsChronologically(shifts);
  const operationalStatus = resolveGigOperationalStatus(gig, sortedShifts, now);
  const shiftCards = sortedShifts.map((shift) =>
    buildShiftCard(shift, operationalStatus, gig.date, now),
  );
  const staffProfileById = new Map(
    staffProfiles.map((staffProfile) => [staffProfile.id, staffProfile]),
  );
  const roster = buildRosterEntries(
    sortedShifts,
    operationalStatus,
    gig.date,
    staffProfileById,
    now,
  );
  const checkedInCount = shiftCards.reduce((count, shift) => count + shift.onSiteCount, 0);
  const plannedCount = shiftCards.reduce((count, shift) => count + shift.plannedCount, 0);
  const confirmedCount = shiftCards.reduce((count, shift) => count + shift.confirmedCount, 0);
  const pendingCount = shiftCards.reduce((count, shift) => count + shift.pendingCount, 0);
  const lateCount = shiftCards.reduce((count, shift) => count + shift.lateCount, 0);
  const understaffedShiftCount = shiftCards.filter((shift) => shift.gapCount > 0).length;
  const fullShiftCount = shiftCards.filter((shift) => shift.isFullyStaffed).length;
  const approvedTimeReportCount = sortedShifts.reduce(
    (count, shift) =>
      count +
      shift.assignments.filter((assignment) => assignment.timeReportApproved === true).length,
    0,
  );
  const quickActionTargetShiftId =
    shiftCards.find((shift) => shift.gapCount > 0)?.id ??
    shiftCards.find((shift) => shift.lateCount > 0)?.id ??
    shiftCards[0]?.id ??
    null;

  return {
    gig,
    roleLabel: scmData.roleDefinition.label,
    operationalStatus,
    operationalStatusLabel: getOperationalStatusLabel(operationalStatus),
    timelineLabel: getTimelineLabel(gig, sortedShifts),
    summary: {
      checkedInCount,
      plannedCount,
      confirmedCount,
      fullShiftCount,
      totalShiftCount: shiftCards.length,
      understaffedShiftCount,
      lateCount,
      pendingCount,
      deviationCount: gig.alertCount + lateCount + understaffedShiftCount,
      approvedTimeReportCount,
      correctableTimeEntryCount: roster.filter(
        (entry) => entry.bookingStatus === "Confirmed" && entry.status !== "checkedOut",
      ).length,
    },
    quickActionTargetShiftId,
    shifts: shiftCards,
    roster,
    files: [...(gig.files ?? [])]
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
      .map((file) => ({
        id: file.id,
        fileName: file.fileName,
        url: file.url,
        section: file.section ?? "files",
        folderName: file.folderName,
        uploadedAt: file.uploadedAt,
        extension: file.extension,
        fileSize: file.fileSize,
      })),
    recentMessages: communication.messages.slice(0, 3).map((message) => ({
      id: message.id,
      body: message.body,
      audienceLabel: message.audienceLabel,
      createdAt: message.createdAt,
    })),
  } satisfies StaffAppScmGigWorkspace;
}

export async function getStaffAppScmGigConversationThreads(
  profile: StoredScmStaffProfile,
  gigId: string,
): Promise<StaffAppScmConversationThread[] | null> {
  const workspace = await getStaffAppScmGigWorkspace(profile, gigId);

  if (!workspace) {
    return null;
  }

  const [communication, staffProfiles, shifts] = await Promise.all([
    getStoredShiftCommunication(gigId),
    getAllStoredStaffProfiles(),
    getStoredGigTimeReportShifts(gigId),
  ]);
  const staffProfileById = new Map(
    staffProfiles.map((staffProfile) => [staffProfile.id, staffProfile]),
  );
  const groupNameById = new Map(
    communication.customGroups.map((group) => [group.id, group.name.trim()]),
  );

  return buildShiftCommunicationThreadSummaries(communication.messages).map((thread) => ({
    id: thread.id,
    gigId,
    title: buildScmConversationTitle(
      thread,
      shifts,
      staffProfileById,
      groupNameById,
    ),
    audience: thread.audience,
    audienceLabel: thread.audienceLabel,
    recipientIds: [...thread.recipientIds],
    shiftId: thread.shiftId,
    groupId: thread.groupId,
    preview: buildShiftCommunicationMessagePreview(thread.latestMessage),
    lastActivityAt: thread.lastActivityAt,
    recipientCount: thread.recipientIds.length,
    messageCount: thread.messageCount,
    allowReplies: thread.allowReplies,
    messages: thread.messages.map((message) => ({
      id: message.id,
      author: message.authorName?.trim() || "SCM",
      body: message.body,
      sentAt: message.createdAt,
      direction: message.authorType === "staff" ? "incoming" : "outgoing",
      allowReplies: message.allowReplies !== false,
      attachments: message.attachments ?? [],
    })),
  }));
}

export async function getStaffAppScmGigConversationThreadById(
  profile: StoredScmStaffProfile,
  gigId: string,
  threadId: string,
) {
  const threads = await getStaffAppScmGigConversationThreads(profile, gigId);

  if (!threads) {
    return null;
  }

  return threads.find((thread) => thread.id === threadId) ?? null;
}

export async function getStaffAppScmShiftWorkspace(
  profile: StoredScmStaffProfile,
  gigId: string,
  shiftId: string,
) {
  const workspace = await getStaffAppScmGigWorkspace(profile, gigId);

  if (!workspace) {
    return null;
  }

  const shift = (await getStoredGigTimeReportShifts(gigId)).find(
    (candidate) => candidate.id === shiftId,
  );

  if (!shift) {
    return null;
  }

  const shiftCard = workspace.shifts.find((candidate) => candidate.id === shiftId);
  const availableStaff = (await getAvailableStaffProfilesForShift(workspace.gig, shift))
    .filter(
      (staffProfile) =>
        !shift.assignments.some((assignment) => assignment.staffId === staffProfile.id),
    )
    .map((staffProfile) => ({
      id: staffProfile.id,
      displayName: staffProfile.displayName,
      roleLabel: staffProfile.roles.join(" / ") || "No role set",
      regionLabel: [staffProfile.region, staffProfile.country].filter(Boolean).join(", "),
    }));

  return {
    gig: workspace.gig,
    shift,
    roleLabel: workspace.roleLabel,
    gigStatusLabel: workspace.operationalStatusLabel,
    shiftStatusLabel: shiftCard?.shiftStatusLabel ?? workspace.operationalStatusLabel,
    confirmedCount: shiftCard?.confirmedCount ?? getConfirmedAssignments(shift).length,
    pendingCount: shiftCard?.pendingCount ?? getPendingAssignments(shift).length,
    waitlistCount: getWaitlistedAssignments(shift).length,
    gapCount:
      shiftCard?.gapCount ??
      Math.max(shift.requiredStaff - getConfirmedAssignments(shift).length, 0),
    lateCount: shiftCard?.lateCount ?? 0,
    roster: workspace.roster.filter((entry) => entry.shiftId === shiftId),
    availableStaff,
  } satisfies StaffAppScmShiftWorkspace;
}
