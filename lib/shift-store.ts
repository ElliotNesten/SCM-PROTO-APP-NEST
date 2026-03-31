import { promises as fs } from "fs";
import path from "path";

import { shifts as seedShifts } from "@/data/scm-data";
import { resolveEffectiveHourlyRate } from "@/lib/compensation";
import {
  clearStoredGigTimeReportFinalApproval,
  getAllStoredGigs,
} from "@/lib/gig-store";
import { removeStoredStaffDocumentsForGig } from "@/lib/staff-document-store";
import {
  getAllStoredStaffProfiles,
  getStoredStaffProfileById,
  type StoredStaffProfile,
} from "@/lib/staff-store";
import { getSystemCompensationSettings } from "@/lib/system-compensation-store";
import type { Assignment, BookingStatus, Gig, PriorityTag, Shift } from "@/types/scm";
import type { StaffRoleKey } from "@/types/staff-role";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "shift-store.json");

const roleOrder = ["Stand Leader", "Seller", "Runner"] as const;

type StoredShiftRecord = Omit<Shift, "priorityLevel"> & {
  priorityLevel?: number;
};

type UpdateStoredShiftAssignmentInput = {
  bookingStatus?: BookingStatus | null;
  checkedIn?: string | null;
  checkedOut?: string | null;
  lunchProvided?: boolean;
  dinnerProvided?: boolean;
  timeReportApproved?: boolean;
  timeReportApprovedAt?: string;
};

export type CreateStoredShiftInput = {
  role: "Stand Leader" | "Seller" | "Runner" | "Other";
  customRole?: string;
  priorityLevel?: number;
  requiredStaff: number;
  startTime: string;
  endTime: string;
  notes?: string;
};

export type UpdateStoredShiftInput = {
  priorityLevel?: number;
  requiredStaff: number;
  startTime: string;
  endTime: string;
  notes?: string;
};

function getDefaultPriorityLevel(role: string) {
  if (role === "Stand Leader") {
    return 1;
  }

  if (role === "Seller") {
    return 2;
  }

  if (role === "Runner") {
    return 3;
  }

  return 5;
}

function isGigMarkedNoMerch(gig: Gig) {
  return gig.overviewIndicator === "noMerch";
}

function clampPriorityLevel(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(5, Math.max(1, Math.round(value ?? fallback)));
}

function sortShiftList(shifts: Shift[]) {
  return [...shifts].sort((left, right) => {
    const leftRoleIndex = roleOrder.indexOf(left.role as (typeof roleOrder)[number]);
    const rightRoleIndex = roleOrder.indexOf(right.role as (typeof roleOrder)[number]);

    if (leftRoleIndex !== rightRoleIndex) {
      return (leftRoleIndex === -1 ? 99 : leftRoleIndex) - (rightRoleIndex === -1 ? 99 : rightRoleIndex);
    }

    if (left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }

    return left.id.localeCompare(right.id);
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getShiftNotes(role: string, customNotes?: string) {
  const trimmedNotes = customNotes?.trim();

  if (trimmedNotes) {
    return trimmedNotes;
  }

  if (role === "Stand Leader") {
    return "Lead main floor stands.";
  }

  if (role === "Seller") {
    return "Main sales team.";
  }

  if (role === "Runner") {
    return "Stock refills and support.";
  }

  return "Custom operational unit.";
}

function getShiftPriority(role: string): PriorityTag {
  if (role === "Stand Leader" || role === "Seller") {
    return "High";
  }

  if (role === "Runner") {
    return "Medium";
  }

  return "Medium";
}

function normalizeShiftRole(input: CreateStoredShiftInput) {
  return input.role === "Other" ? input.customRole?.trim() || "Other" : input.role.trim();
}

function normalizeAssignmentTimestampValue(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function hasCompleteAssignmentTimes(
  checkedIn: string | null | undefined,
  checkedOut: string | null | undefined,
) {
  return Boolean(checkedIn?.trim() && checkedOut?.trim());
}

function normalizeStoredShift(shift: StoredShiftRecord): Shift {
  const normalizedAssignments = Array.isArray(shift.assignments)
    ? shift.assignments.map(
        (assignment): Assignment => ({
          ...assignment,
          hourlyRate:
            typeof assignment.hourlyRate === "number" &&
            Number.isFinite(assignment.hourlyRate)
              ? Math.max(1, Math.round(assignment.hourlyRate))
              : undefined,
          hourlyRateCurrency:
            typeof assignment.hourlyRateCurrency === "string" &&
            ["SEK", "NOK", "DKK", "EUR"].includes(
              assignment.hourlyRateCurrency.trim().toUpperCase(),
            )
              ? (assignment.hourlyRateCurrency.trim().toUpperCase() as Assignment["hourlyRateCurrency"])
              : undefined,
          hourlyRateCountry:
            typeof assignment.hourlyRateCountry === "string" &&
            ["Sweden", "Norway", "Denmark", "Finland"].includes(
              assignment.hourlyRateCountry.trim(),
            )
              ? (assignment.hourlyRateCountry.trim() as Assignment["hourlyRateCountry"])
              : undefined,
          hourlyRateSource:
            assignment.hourlyRateSource === "profileOverride" ||
            assignment.hourlyRateSource === "standard"
              ? assignment.hourlyRateSource
              : undefined,
          checkedIn:
            typeof assignment.checkedIn === "string" && assignment.checkedIn.trim().length > 0
              ? assignment.checkedIn.trim()
              : undefined,
          checkedOut:
            typeof assignment.checkedOut === "string" && assignment.checkedOut.trim().length > 0
              ? assignment.checkedOut.trim()
              : undefined,
          lunchProvided:
            typeof assignment.lunchProvided === "boolean"
              ? assignment.lunchProvided
              : undefined,
          dinnerProvided:
            typeof assignment.dinnerProvided === "boolean"
              ? assignment.dinnerProvided
              : undefined,
          timeReportApproved:
            typeof assignment.timeReportApproved === "boolean"
              ? assignment.timeReportApproved
              : undefined,
          timeReportApprovedAt:
            typeof assignment.timeReportApprovedAt === "string" &&
            assignment.timeReportApprovedAt.trim().length > 0
              ? assignment.timeReportApprovedAt
              : undefined,
        }),
      )
    : [];

  return {
    ...shift,
    assignments: normalizedAssignments,
    priorityLevel: clampPriorityLevel(
      shift.priorityLevel,
      getDefaultPriorityLevel(shift.role),
    ),
  };
}

async function ensureShiftStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(seedShifts, null, 2), "utf8");
  }
}

async function readShiftStore() {
  await ensureShiftStore();
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw) as StoredShiftRecord[];
}

async function writeShiftStore(shifts: Shift[]) {
  await fs.writeFile(storePath, JSON.stringify(shifts, null, 2), "utf8");
}

async function invalidateStoredGigTimeReportArtifacts(gigId: string) {
  await Promise.all([
    clearStoredGigTimeReportFinalApproval(gigId),
    removeStoredStaffDocumentsForGig(gigId),
  ]);
}

async function syncShiftsWithGigs() {
  const [storedShifts, gigs] = await Promise.all([readShiftStore(), getAllStoredGigs()]);
  const syncedShifts = storedShifts.map((shift) => normalizeStoredShift(shift));
  let didChange = storedShifts.some(
    (shift, index) => shift.priorityLevel !== syncedShifts[index]?.priorityLevel,
  );
  const gigIdsWithClearedAssignments = new Set<string>();

  gigs
    .filter((gig) => isGigMarkedNoMerch(gig))
    .forEach((gig) => {
      syncedShifts.forEach((shift, index) => {
        if (shift.gigId !== gig.id || shift.assignments.length === 0) {
          return;
        }

        syncedShifts[index] = {
          ...shift,
          assignments: [],
        };
        didChange = true;
        gigIdsWithClearedAssignments.add(gig.id);
      });
    });

  if (didChange) {
    await writeShiftStore(syncedShifts);
    await Promise.all(
      [...gigIdsWithClearedAssignments].map((gigId) =>
        invalidateStoredGigTimeReportArtifacts(gigId),
      ),
    );
  }

  return syncedShifts;
}

export function getConfirmedCount(shift: Shift) {
  return shift.assignments.filter((assignment) => assignment.bookingStatus === "Confirmed").length;
}

export function getWaitlistCount(shift: Shift) {
  return shift.assignments.filter((assignment) => assignment.bookingStatus === "Waitlisted").length;
}

export function getOpenSlots(shift: Shift) {
  return Math.max(shift.requiredStaff - getConfirmedCount(shift), 0);
}

export async function getAllStoredShifts() {
  return sortShiftList(await syncShiftsWithGigs());
}

export async function getStoredGigShifts(gigId: string) {
  const shifts = await syncShiftsWithGigs();
  return sortShiftList(shifts.filter((shift) => shift.gigId === gigId));
}

export async function getStoredShiftById(shiftId: string) {
  const shifts = await syncShiftsWithGigs();
  return shifts.find((shift) => shift.id === shiftId);
}

export async function createStoredShift(gigId: string, input: CreateStoredShiftInput) {
  const shifts = await syncShiftsWithGigs();
  const normalizedRole = normalizeShiftRole(input);
  const roleSlug = slugify(normalizedRole) || "shift";
  const priorityLevel = clampPriorityLevel(
    input.priorityLevel,
    getDefaultPriorityLevel(normalizedRole),
  );

  let sequence = 1;
  let nextId = `${gigId}-${roleSlug}-${sequence}`;

  while (shifts.some((shift) => shift.id === nextId)) {
    sequence += 1;
    nextId = `${gigId}-${roleSlug}-${sequence}`;
  }

  const createdShift: Shift = {
    id: nextId,
    gigId,
    role: normalizedRole,
    priorityLevel,
    startTime: input.startTime,
    endTime: input.endTime,
    requiredStaff: Math.max(1, Math.round(input.requiredStaff)),
    notes: getShiftNotes(normalizedRole, input.notes),
    priorityTag: getShiftPriority(normalizedRole),
    assignments: [],
  };

  const nextShifts = sortShiftList([...shifts, createdShift]);
  await writeShiftStore(nextShifts);

  return createdShift;
}

export async function updateStoredShift(
  gigId: string,
  shiftId: string,
  input: UpdateStoredShiftInput,
) {
  const shifts = await syncShiftsWithGigs();
  const shiftIndex = shifts.findIndex((shift) => shift.id === shiftId && shift.gigId === gigId);

  if (shiftIndex === -1) {
    return null;
  }

  const currentShift = shifts[shiftIndex];
  const priorityLevel = clampPriorityLevel(
    input.priorityLevel,
    currentShift.priorityLevel ?? getDefaultPriorityLevel(currentShift.role),
  );

  shifts[shiftIndex] = {
    ...currentShift,
    priorityLevel,
    startTime: input.startTime,
    endTime: input.endTime,
    requiredStaff: Math.max(1, Math.round(input.requiredStaff)),
    notes: getShiftNotes(currentShift.role, input.notes),
    priorityTag: getShiftPriority(currentShift.role),
  };

  const nextShifts = sortShiftList(shifts);
  await writeShiftStore(nextShifts);
  await invalidateStoredGigTimeReportArtifacts(gigId);

  return nextShifts.find((shift) => shift.id === shiftId && shift.gigId === gigId) ?? null;
}

export async function deleteStoredShift(gigId: string, shiftId: string) {
  const shifts = await syncShiftsWithGigs();
  const nextShifts = shifts.filter((shift) => !(shift.id === shiftId && shift.gigId === gigId));

  if (nextShifts.length === shifts.length) {
    return false;
  }

  await writeShiftStore(nextShifts);
  await invalidateStoredGigTimeReportArtifacts(gigId);
  return true;
}

export async function deleteStoredGigShifts(gigId: string) {
  const shifts = await syncShiftsWithGigs();
  const nextShifts = shifts.filter((shift) => shift.gigId !== gigId);

  if (nextShifts.length === shifts.length) {
    return 0;
  }

  await writeShiftStore(nextShifts);
  await invalidateStoredGigTimeReportArtifacts(gigId);
  return shifts.length - nextShifts.length;
}

export async function getAssignedStaffProfilesForGig(gigId: string) {
  const [gigShifts, staffProfiles] = await Promise.all([
    getStoredGigShifts(gigId),
    getAllStoredStaffProfiles(),
  ]);

  const assignedIds = new Set(
    gigShifts.flatMap((shift) => shift.assignments.map((assignment) => assignment.staffId)),
  );

  return staffProfiles.filter((profile) => assignedIds.has(profile.id));
}

function rankCandidate(profile: StoredStaffProfile, gig: Gig, shift: Shift) {
  const roleMatch = hasShiftRoleAccess(profile, shift.role);
  const locationMatch = hasMatchingGigLocation(profile, gig);

  if (roleMatch && locationMatch) {
    return 0;
  }

  if (locationMatch) {
    return 1;
  }

  if (roleMatch) {
    return 2;
  }

  return 3;
}

function mapShiftRoleToStaffRoleKey(role: string): StaffRoleKey {
  if (role === "Stand Leader" || role === "Seller" || role === "Runner") {
    return role;
  }

  return "Other";
}

function hasShiftRoleAccess(profile: StoredStaffProfile, shiftRole: string) {
  const roleKey = mapShiftRoleToStaffRoleKey(shiftRole);
  return profile.roleProfiles?.[roleKey]?.enabled ?? profile.roles.includes(shiftRole);
}

function hasHourlyRateSnapshot(assignment: Assignment | undefined) {
  return Boolean(
    assignment &&
      typeof assignment.hourlyRate === "number" &&
      Number.isFinite(assignment.hourlyRate) &&
      typeof assignment.hourlyRateCurrency === "string" &&
      assignment.hourlyRateCurrency.trim().length > 0,
  );
}

function buildAssignmentHourlyRateSnapshot(
  profile: StoredStaffProfile,
  shiftRole: string,
  defaultHourlyRates: Awaited<
    ReturnType<typeof getSystemCompensationSettings>
  >["defaultHourlyRates"],
) {
  const resolvedHourlyRate = resolveEffectiveHourlyRate({
    country: profile.country,
    roleKey: mapShiftRoleToStaffRoleKey(shiftRole),
    roleProfiles: profile.roleProfiles,
    defaultHourlyRates,
  });

  return {
    hourlyRate: resolvedHourlyRate.hourlyRate,
    hourlyRateCurrency: resolvedHourlyRate.currency,
    hourlyRateCountry: resolvedHourlyRate.country,
    hourlyRateSource: resolvedHourlyRate.source,
  } satisfies Pick<
    Assignment,
    "hourlyRate" | "hourlyRateCurrency" | "hourlyRateCountry" | "hourlyRateSource"
  >;
}

function getShiftRolePriority(profile: StoredStaffProfile, shiftRole: string) {
  const roleKey = mapShiftRoleToStaffRoleKey(shiftRole);
  const configuredPriority = profile.roleProfiles?.[roleKey]?.priority;

  if (Number.isFinite(configuredPriority)) {
    return configuredPriority ?? profile.priority;
  }

  return profile.priority;
}

function normalizeLocationValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function hasMatchingGigLocation(profile: StoredStaffProfile, gig: Gig) {
  const gigCountry = normalizeLocationValue(gig.country);
  const gigRegion = normalizeLocationValue(gig.region);
  const profileCountry = normalizeLocationValue(profile.country);
  const profileRegion = normalizeLocationValue(profile.region);

  if (!gigCountry || gigCountry !== profileCountry) {
    return false;
  }

  if (!gigRegion) {
    return true;
  }

  return gigRegion === profileRegion;
}

export function isStaffEligibleForShift(
  profile: StoredStaffProfile,
  gig: Gig,
  shift: Shift,
) {
  if (profile.approvalStatus === "Archived") {
    return false;
  }

  if (!hasMatchingGigLocation(profile, gig)) {
    return false;
  }

  if (!hasShiftRoleAccess(profile, shift.role)) {
    return false;
  }

  return getShiftRolePriority(profile, shift.role) <= shift.priorityLevel;
}

export async function getAvailableStaffProfilesForShift(
  gig: Gig,
  shift: Shift,
  options?: { includeStaffIds?: string[] },
) {
  const staffProfiles = await getAllStoredStaffProfiles();
  const assignedIds = new Set(shift.assignments.map((assignment) => assignment.staffId));
  const includedStaffIds = new Set(
    (options?.includeStaffIds ?? []).map((staffId) => staffId.trim()).filter(Boolean),
  );

  return [...staffProfiles]
    .filter(
      (profile) =>
        assignedIds.has(profile.id) ||
        includedStaffIds.has(profile.id) ||
        isStaffEligibleForShift(profile, gig, shift),
    )
    .sort((left, right) => {
      const rankDifference = rankCandidate(left, gig, shift) - rankCandidate(right, gig, shift);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      const priorityDifference =
        getShiftRolePriority(left, shift.role) - getShiftRolePriority(right, shift.role);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return left.displayName.localeCompare(right.displayName);
    });
}

export async function updateStoredShiftAssignment(
  gigId: string,
  shiftId: string,
  staffId: string,
  input: UpdateStoredShiftAssignmentInput,
) {
  const [shifts, compensationSettings] = await Promise.all([
    syncShiftsWithGigs(),
    getSystemCompensationSettings(),
  ]);
  const shiftIndex = shifts.findIndex((shift) => shift.id === shiftId && shift.gigId === gigId);

  if (shiftIndex === -1) {
    return null;
  }

  const currentShift = shifts[shiftIndex];
  const existingAssignments = currentShift.assignments;
  const currentAssignment = existingAssignments.find((assignment) => assignment.staffId === staffId);
  const nextBookingStatus = input.bookingStatus;
  const normalizedCheckedIn = normalizeAssignmentTimestampValue(input.checkedIn);
  const normalizedCheckedOut = normalizeAssignmentTimestampValue(input.checkedOut);
  const hasExplicitTimeUpdate = input.checkedIn !== undefined || input.checkedOut !== undefined;
  const shouldRefreshHourlyRateSnapshot =
    nextBookingStatus !== null &&
    (!currentAssignment ||
      nextBookingStatus !== undefined ||
      !hasHourlyRateSnapshot(currentAssignment));
  const staffProfile =
    shouldRefreshHourlyRateSnapshot
      ? await getStoredStaffProfileById(staffId)
      : null;
  const hourlyRateSnapshot =
    staffProfile && nextBookingStatus !== null
      ? buildAssignmentHourlyRateSnapshot(
          staffProfile,
          currentShift.role,
          compensationSettings.defaultHourlyRates,
        )
      : null;

  if (
    nextBookingStatus === "Confirmed" &&
    currentAssignment?.bookingStatus !== "Confirmed" &&
    getConfirmedCount(currentShift) >= currentShift.requiredStaff
  ) {
    throw new Error("This shift is already fully booked.");
  }

  let nextAssignments = existingAssignments;

  if (nextBookingStatus === null) {
    nextAssignments = existingAssignments.filter((assignment) => assignment.staffId !== staffId);
  } else if (currentAssignment) {
    nextAssignments = existingAssignments.map((assignment) =>
      assignment.staffId === staffId
        ? (() => {
            const nextCheckedIn =
              normalizedCheckedIn === undefined ? assignment.checkedIn : normalizedCheckedIn ?? undefined;
            const nextCheckedOut =
              normalizedCheckedOut === undefined ? assignment.checkedOut : normalizedCheckedOut ?? undefined;
            const shouldClearApproval =
              hasExplicitTimeUpdate && !hasCompleteAssignmentTimes(nextCheckedIn, nextCheckedOut);
            const nextTimeReportApproved = shouldClearApproval
              ? false
              : input.timeReportApproved === undefined
                ? assignment.timeReportApproved
                : input.timeReportApproved;
            const nextHourlyRateSnapshot =
              assignment.staffId === staffId && hourlyRateSnapshot
                ? hourlyRateSnapshot
                : {
                    hourlyRate: assignment.hourlyRate,
                    hourlyRateCurrency: assignment.hourlyRateCurrency,
                    hourlyRateCountry: assignment.hourlyRateCountry,
                    hourlyRateSource: assignment.hourlyRateSource,
                  };

            return {
              ...assignment,
              bookingStatus: nextBookingStatus ?? assignment.bookingStatus,
              hourlyRate: nextHourlyRateSnapshot.hourlyRate,
              hourlyRateCurrency: nextHourlyRateSnapshot.hourlyRateCurrency,
              hourlyRateCountry: nextHourlyRateSnapshot.hourlyRateCountry,
              hourlyRateSource: nextHourlyRateSnapshot.hourlyRateSource,
              checkedIn: nextCheckedIn,
              checkedOut: nextCheckedOut,
              lunchProvided:
                input.lunchProvided === undefined
                  ? assignment.lunchProvided
                  : input.lunchProvided,
              dinnerProvided:
                input.dinnerProvided === undefined
                  ? assignment.dinnerProvided
                  : input.dinnerProvided,
              timeReportApproved: nextTimeReportApproved,
              timeReportApprovedAt: shouldClearApproval
                ? undefined
                : input.timeReportApproved === undefined
                  ? assignment.timeReportApprovedAt
                  : nextTimeReportApproved
                    ? input.timeReportApprovedAt ??
                      assignment.timeReportApprovedAt ??
                      new Date().toISOString()
                    : undefined,
            };
          })()
        : assignment,
    );
  } else {
    const nextCheckedIn = normalizedCheckedIn ?? undefined;
    const nextCheckedOut = normalizedCheckedOut ?? undefined;
    const nextTimeReportApproved =
      input.timeReportApproved === true &&
      hasCompleteAssignmentTimes(nextCheckedIn, nextCheckedOut)
        ? true
        : undefined;

    nextAssignments = [
      ...existingAssignments,
      {
        staffId,
        bookingStatus: nextBookingStatus ?? "Pending",
        hourlyRate: hourlyRateSnapshot?.hourlyRate,
        hourlyRateCurrency: hourlyRateSnapshot?.hourlyRateCurrency,
        hourlyRateCountry: hourlyRateSnapshot?.hourlyRateCountry,
        hourlyRateSource: hourlyRateSnapshot?.hourlyRateSource,
        checkedIn: nextCheckedIn,
        checkedOut: nextCheckedOut,
        lunchProvided: input.lunchProvided,
        dinnerProvided: input.dinnerProvided,
        timeReportApproved: nextTimeReportApproved,
        timeReportApprovedAt: nextTimeReportApproved
          ? input.timeReportApprovedAt ?? new Date().toISOString()
          : undefined,
      },
    ];
  }

  shifts[shiftIndex] = {
    ...shifts[shiftIndex],
    assignments: nextAssignments,
  };

  await writeShiftStore(shifts);
  await invalidateStoredGigTimeReportArtifacts(gigId);
  return shifts[shiftIndex];
}

export async function setStoredShiftTimeReportsApprovalState(
  gigId: string,
  shiftId: string,
  approved: boolean,
  staffIds?: string[],
) {
  const shifts = await syncShiftsWithGigs();
  const shiftIndex = shifts.findIndex((shift) => shift.id === shiftId && shift.gigId === gigId);

  if (shiftIndex === -1) {
    return null;
  }

  const approvedAt = new Date().toISOString();
  const targetStaffIds =
    Array.isArray(staffIds) && staffIds.length > 0
      ? new Set(staffIds.map((staffId) => staffId.trim()).filter(Boolean))
      : null;

  shifts[shiftIndex] = {
    ...shifts[shiftIndex],
    assignments: shifts[shiftIndex].assignments.map((assignment) => {
      const isConfirmedAssignment = assignment.bookingStatus === "Confirmed";
      const isTargetedAssignment = targetStaffIds
        ? targetStaffIds.has(assignment.staffId)
        : true;

      if (!isConfirmedAssignment || !isTargetedAssignment) {
        return assignment;
      }

      return {
        ...assignment,
        timeReportApproved: approved,
        timeReportApprovedAt: approved ? assignment.timeReportApprovedAt ?? approvedAt : undefined,
      };
    }),
  };

  await writeShiftStore(shifts);
  await invalidateStoredGigTimeReportArtifacts(gigId);
  return shifts[shiftIndex];
}

export async function approveStoredShiftTimeReports(
  gigId: string,
  shiftId: string,
  staffIds?: string[],
) {
  return setStoredShiftTimeReportsApprovalState(gigId, shiftId, true, staffIds);
}
