"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Shift } from "@/types/scm";

export type TimeReportStaffProfile = {
  id: string;
  displayName: string;
  region: string;
  country: string;
};

type ShiftAssignment = Shift["assignments"][number];

type TimeDraft = {
  checkedIn: string;
  checkedOut: string;
};

const timeReportDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeReportDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function buildAssignmentKey(shiftId: string, staffId: string) {
  return `${shiftId}:${staffId}`;
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function isAssignmentTimeReportApproved(assignment: ShiftAssignment) {
  return assignment.timeReportApproved === true;
}

function hasCompleteTimeEntry(assignment: Pick<ShiftAssignment, "checkedIn" | "checkedOut">) {
  return Boolean(assignment.checkedIn?.trim() && assignment.checkedOut?.trim());
}

function isShiftTimeReportApproved(shift: Shift) {
  const confirmedAssignments = shift.assignments.filter(
    (assignment) => assignment.bookingStatus === "Confirmed",
  );

  return (
    confirmedAssignments.length > 0 &&
    confirmedAssignments.every((assignment) => isAssignmentTimeReportApproved(assignment))
  );
}

function getConfirmedTimeReportAssignments(shifts: Shift[]) {
  return shifts.flatMap((shift) =>
    shift.assignments.filter((assignment) => assignment.bookingStatus === "Confirmed"),
  );
}

function formatTimeReportTimestamp(value?: string) {
  if (!value?.trim()) {
    return "Missing";
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return value;
  }

  return timeReportDateTimeFormatter.format(parsedValue);
}

function formatGigDateLabel(value: string) {
  const parsedValue = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsedValue.getTime())) {
    return value;
  }

  return timeReportDateFormatter.format(parsedValue);
}

function toTimeInputValue(value?: string) {
  if (!value?.trim()) {
    return "";
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  const hours = String(parsedValue.getHours()).padStart(2, "0");
  const minutes = String(parsedValue.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function addDaysToIsoDate(value: string, days: number) {
  const parsedValue = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsedValue.getTime())) {
    return value;
  }

  parsedValue.setDate(parsedValue.getDate() + days);

  const year = parsedValue.getFullYear();
  const month = String(parsedValue.getMonth() + 1).padStart(2, "0");
  const day = String(parsedValue.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toStoredTimeReportValue(gigDate: string, timeValue: string, dayOffset = 0) {
  const trimmedValue = timeValue.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedGigDate = dayOffset === 0 ? gigDate : addDaysToIsoDate(gigDate, dayOffset);
  const parsedValue = new Date(`${normalizedGigDate}T${trimmedValue}:00`);

  if (Number.isNaN(parsedValue.getTime())) {
    return undefined;
  }

  return parsedValue.toISOString();
}

function getCheckoutDayOffset(
  shift: Pick<Shift, "startTime" | "endTime">,
  checkedInTime: string,
  checkedOutTime: string,
) {
  const shiftStartMinutes = parseTimeToMinutes(shift.startTime);
  const shiftEndMinutes = parseTimeToMinutes(shift.endTime);
  const checkedInMinutes = parseTimeToMinutes(checkedInTime);
  const checkedOutMinutes = parseTimeToMinutes(checkedOutTime);

  if (shiftStartMinutes !== null && shiftEndMinutes !== null && shiftEndMinutes < shiftStartMinutes) {
    return 1;
  }

  if (shiftStartMinutes !== null && checkedOutMinutes !== null && checkedOutMinutes < shiftStartMinutes) {
    return 1;
  }

  if (checkedInMinutes !== null && checkedOutMinutes !== null && checkedOutMinutes < checkedInMinutes) {
    return 1;
  }

  return 0;
}

function isValidTimeInputValue(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return true;
  }

  return /^\d{2}:\d{2}$/.test(trimmedValue);
}

export function GigTimeReportPanel({
  gigId,
  gigDate,
  timeReportFinalApprovedAt,
  shifts,
  staffProfiles,
  apiBasePath,
}: {
  gigId: string;
  gigDate: string;
  timeReportFinalApprovedAt?: string;
  shifts: Shift[];
  staffProfiles: TimeReportStaffProfile[];
  apiBasePath?: string;
}) {
  const router = useRouter();
  const [shiftItems, setShiftItems] = useState(shifts);
  const [pendingFoodKey, setPendingFoodKey] = useState<string | null>(null);
  const [pendingApprovalKey, setPendingApprovalKey] = useState<string | null>(null);
  const [pendingTimeKey, setPendingTimeKey] = useState<string | null>(null);
  const [editingAssignmentKey, setEditingAssignmentKey] = useState<string | null>(null);
  const [timeDraft, setTimeDraft] = useState<TimeDraft>({
    checkedIn: "",
    checkedOut: "",
  });
  const [finalApprovedAt, setFinalApprovedAt] = useState<string | null>(
    timeReportFinalApprovedAt ?? null,
  );
  const [expandedApprovedShiftIds, setExpandedApprovedShiftIds] = useState<string[]>([]);
  const [timeReportError, setTimeReportError] = useState<string | null>(null);
  const [timeReportFeedback, setTimeReportFeedback] = useState<string | null>(null);
  const [isFinalizingTimeReport, setIsFinalizingTimeReport] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const resolvedApiBasePath = apiBasePath ?? `/api/gigs/${gigId}`;

  useEffect(() => {
    setShiftItems(shifts);
  }, [shifts]);

  useEffect(() => {
    setFinalApprovedAt(timeReportFinalApprovedAt ?? null);
    if (!timeReportFinalApprovedAt) {
      setTimeReportFeedback(null);
    } else {
      setShowFinalizeConfirm(false);
      setEditingAssignmentKey(null);
    }
  }, [timeReportFinalApprovedAt]);

  const staffById = useMemo(
    () => new Map(staffProfiles.map((person) => [person.id, person])),
    [staffProfiles],
  );
  const gigDateLabel = useMemo(() => formatGigDateLabel(gigDate), [gigDate]);
  const timeReportShiftItems = useMemo(
    () =>
      shiftItems.filter((shift) =>
        shift.assignments.some(
          (assignment) => assignment.bookingStatus === "Confirmed",
        ),
      ),
    [shiftItems],
  );
  const confirmedTimeReportAssignments = useMemo(
    () => getConfirmedTimeReportAssignments(timeReportShiftItems),
    [timeReportShiftItems],
  );
  const allTimeReportsApproved = useMemo(
    () =>
      confirmedTimeReportAssignments.length > 0 &&
      confirmedTimeReportAssignments.every(
        (assignment) =>
          hasCompleteTimeEntry(assignment) && isAssignmentTimeReportApproved(assignment),
      ),
    [confirmedTimeReportAssignments],
  );
  const isTimeReportLocked = Boolean(finalApprovedAt);

  function replaceShiftItem(updatedShift: Shift, collapseApprovedShift = false) {
    setShiftItems((current) =>
      current.map((shift) => (shift.id === updatedShift.id ? updatedShift : shift)),
    );

    if (collapseApprovedShift && isShiftTimeReportApproved(updatedShift)) {
      setExpandedApprovedShiftIds((current) =>
        current.filter((shiftId) => shiftId !== updatedShift.id),
      );
    }
  }

  function clearFinalTimeReportApprovalState() {
    setFinalApprovedAt(null);
    setTimeReportFeedback(null);
  }

  function startEditingTimes(shiftId: string, assignment: ShiftAssignment) {
    if (isTimeReportLocked) {
      setTimeReportError("The full time report has already been approved and is locked.");
      return;
    }

    setEditingAssignmentKey(buildAssignmentKey(shiftId, assignment.staffId));
    setTimeDraft({
      checkedIn: toTimeInputValue(assignment.checkedIn),
      checkedOut: toTimeInputValue(assignment.checkedOut),
    });
    setTimeReportError(null);
  }

  function cancelEditingTimes() {
    setEditingAssignmentKey(null);
    setTimeDraft({
      checkedIn: "",
      checkedOut: "",
    });
    setPendingTimeKey(null);
    setTimeReportError(null);
  }

  async function updateFoodStatus(
    shiftId: string,
    staffId: string,
    field: "lunchProvided" | "dinnerProvided",
    nextValue: boolean,
  ) {
    if (isTimeReportLocked) {
      setTimeReportError("The full time report has already been approved and is locked.");
      return;
    }

    const pendingKey = `${shiftId}:${staffId}:${field}`;
    setPendingFoodKey(pendingKey);
    setTimeReportError(null);

    const response = await fetch(`${resolvedApiBasePath}/shifts/${shiftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staffId,
        [field]: nextValue,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; shift?: Shift }
      | null;

    if (!response.ok || !payload?.shift) {
      setTimeReportError(payload?.error ?? "Could not update food status.");
      setPendingFoodKey(null);
      return;
    }

    replaceShiftItem(payload.shift);
    clearFinalTimeReportApprovalState();
    setPendingFoodKey(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function setTimeReportApproval(
    shiftId: string,
    staffId: string,
    nextApproved: boolean,
  ) {
    if (isTimeReportLocked) {
      setTimeReportError("The full time report has already been approved and is locked.");
      return;
    }

    const pendingKey = `${shiftId}:${staffId}:timeReportApproved`;
    setPendingApprovalKey(pendingKey);
    setTimeReportError(null);

    const response = await fetch(`${resolvedApiBasePath}/shifts/${shiftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staffId,
        timeReportApproved: nextApproved,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; shift?: Shift }
      | null;

    if (!response.ok || !payload?.shift) {
      setTimeReportError(
        payload?.error ??
          `Could not ${nextApproved ? "approve" : "disapprove"} the time report.`,
      );
      setPendingApprovalKey(null);
      return;
    }

    replaceShiftItem(payload.shift, true);
    clearFinalTimeReportApprovalState();
    setPendingApprovalKey(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function setAllTimeReportsApproval(shiftId: string, nextApproved: boolean) {
    if (isTimeReportLocked) {
      setTimeReportError("The full time report has already been approved and is locked.");
      return;
    }

    const pendingKey = `${shiftId}:all`;
    setPendingApprovalKey(pendingKey);
    setTimeReportError(null);

    const response = await fetch(`${resolvedApiBasePath}/shifts/${shiftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        setAllTimeReportsApproved: nextApproved,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; shift?: Shift }
      | null;

    if (!response.ok || !payload?.shift) {
      setTimeReportError(
        payload?.error ??
          `Could not ${nextApproved ? "approve" : "disapprove"} all time reports.`,
      );
      setPendingApprovalKey(null);
      return;
    }

    replaceShiftItem(payload.shift, true);
    clearFinalTimeReportApprovalState();
    setPendingApprovalKey(null);

    startTransition(() => {
      router.refresh();
    });
  }

  async function saveManualTimes(
    shift: Shift,
    staffId: string,
    options?: { timeReportApproved?: boolean },
  ) {
    if (isTimeReportLocked) {
      setTimeReportError("The full time report has already been approved and is locked.");
      return;
    }

    const shiftId = shift.id;
    const assignmentKey = buildAssignmentKey(shiftId, staffId);
    const approvalKey = `${shiftId}:${staffId}:timeReportApproved`;
    const checkoutDayOffset = getCheckoutDayOffset(
      shift,
      timeDraft.checkedIn,
      timeDraft.checkedOut,
    );
    const checkedIn = toStoredTimeReportValue(gigDate, timeDraft.checkedIn);
    const checkedOut = toStoredTimeReportValue(gigDate, timeDraft.checkedOut, checkoutDayOffset);

    if (!isValidTimeInputValue(timeDraft.checkedIn) || (timeDraft.checkedIn.trim() && checkedIn === undefined)) {
      setTimeReportError("Check-in time is invalid.");
      return;
    }

    if (!isValidTimeInputValue(timeDraft.checkedOut) || (timeDraft.checkedOut.trim() && checkedOut === undefined)) {
      setTimeReportError("Check-out time is invalid.");
      return;
    }

    setPendingTimeKey(assignmentKey);
    if (options?.timeReportApproved !== undefined) {
      setPendingApprovalKey(approvalKey);
    }
    setTimeReportError(null);

    const response = await fetch(`${resolvedApiBasePath}/shifts/${shiftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staffId,
        checkedIn: checkedIn ?? null,
        checkedOut: checkedOut ?? null,
        timeReportApproved: options?.timeReportApproved,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; shift?: Shift }
      | null;

    if (!response.ok || !payload?.shift) {
      setTimeReportError(
        payload?.error ??
          (options?.timeReportApproved !== undefined
            ? `Could not ${
                options.timeReportApproved ? "save and approve" : "save and disapprove"
              } the time report.`
            : "Could not save the manual times."),
      );
      setPendingTimeKey(null);
      setPendingApprovalKey(null);
      return;
    }

    replaceShiftItem(payload.shift, true);
    clearFinalTimeReportApprovalState();
    setPendingTimeKey(null);
    setPendingApprovalKey(null);
    setEditingAssignmentKey(null);
    setTimeDraft({
      checkedIn: "",
      checkedOut: "",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  async function approveFullTimeReport() {
    setIsFinalizingTimeReport(true);
    setTimeReportError(null);
    setTimeReportFeedback(null);

    const response = await fetch(`${resolvedApiBasePath}/time-report`, {
      method: "POST",
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; approvedAt?: string; generatedDocumentCount?: number }
      | null;

    if (!response.ok || !payload?.approvedAt) {
      setTimeReportError(payload?.error ?? "Could not approve the full time report.");
      setIsFinalizingTimeReport(false);
      return;
    }

    setFinalApprovedAt(payload.approvedAt);
    setShowFinalizeConfirm(false);
    setTimeReportFeedback(
      payload.generatedDocumentCount && payload.generatedDocumentCount > 0
        ? `${payload.generatedDocumentCount} staff documents were generated and saved under Stored files.`
        : "Staff documents were generated and saved under Stored files.",
    );
    setIsFinalizingTimeReport(false);

    startTransition(() => {
      router.refresh();
    });
  }

  function toggleApprovedShift(shiftId: string) {
    setExpandedApprovedShiftIds((current) =>
      current.includes(shiftId)
        ? current.filter((id) => id !== shiftId)
        : [...current, shiftId],
    );
  }

  function openFinalizeConfirm() {
    if (isTimeReportLocked || !allTimeReportsApproved || isFinalizingTimeReport || isPending) {
      return;
    }

    setTimeReportError(null);
    setShowFinalizeConfirm(true);
  }

  return (
    <section id="time-report" className="report-documents-time-report">
      <div className="section-head compact report-documents-time-report-head">
        <div>
          <p className="eyebrow">TIME RAPORT</p>
          <h3>Booked time entries</h3>
          <p className="muted">
            Review confirmed staff check-in and check-out times directly from
            the reports area.
          </p>
        </div>

        <div className="report-documents-time-report-finalize">
          <div className="report-documents-time-report-actions">
            <button
              type="button"
              className="button"
              disabled={
                !allTimeReportsApproved ||
                isTimeReportLocked ||
                isFinalizingTimeReport ||
                isPending
              }
              onClick={() => {
                openFinalizeConfirm();
              }}
            >
              {isFinalizingTimeReport
                ? "Approving..."
                : finalApprovedAt
                  ? "Time report approved"
                  : "Approve time report"}
            </button>
          </div>

          <p className="small-text report-documents-time-report-status">
            {finalApprovedAt
              ? `Staff documents generated ${formatTimeReportTimestamp(finalApprovedAt)}. This time report is locked.`
              : allTimeReportsApproved
                ? "Approve the full time report to generate Employment Contracts and Time Reports."
                : "Approve every booked pass before you approve the full time report."}
          </p>
        </div>
      </div>

      {timeReportError ? (
        <p className="form-error report-documents-time-report-message">{timeReportError}</p>
      ) : null}

      {timeReportFeedback ? (
        <p className="small-text report-documents-time-report-feedback">
          {timeReportFeedback}
        </p>
      ) : null}

      {timeReportShiftItems.length === 0 ? (
        <div className="empty-panel">
          Time reports will appear once staff have been booked on shifts.
        </div>
      ) : (
        <div className="shift-booking-board">
          {timeReportShiftItems.map((shift) => {
            const confirmedAssignments = shift.assignments.filter(
              (assignment) => assignment.bookingStatus === "Confirmed",
            );
            const shiftApproved = isShiftTimeReportApproved(shift);
            const shiftExpanded = !shiftApproved || expandedApprovedShiftIds.includes(shift.id);
            const shiftHasCompleteTimes =
              confirmedAssignments.length > 0 &&
              confirmedAssignments.every((assignment) => hasCompleteTimeEntry(assignment));

            return (
              <section key={shift.id} className="booking-board-group">
                <div className="booking-board-head">
                  <div className="booking-board-head-main">
                    <button
                      type="button"
                      className={`booking-board-toggle ${shiftExpanded ? "expanded" : "collapsed"}`}
                      onClick={() => toggleApprovedShift(shift.id)}
                      aria-expanded={shiftExpanded}
                    >
                      <span className="booking-board-toggle-icon" aria-hidden="true">
                        {shiftExpanded ? "v" : ">"}
                      </span>
                      <span className="booking-board-toggle-copy">
                        <span className="eyebrow">{shift.role}</span>
                        <span className="booking-board-toggle-title">
                          {shift.startTime} to {shift.endTime}
                        </span>
                      </span>
                    </button>

                    {!shiftExpanded && shiftApproved ? (
                      <p className="muted booking-board-collapsed-note">
                        All booked time reports approved.
                      </p>
                    ) : (
                      <p className="muted">{shift.notes}</p>
                    )}
                  </div>

                  <div className="booking-board-meta booking-board-meta-time-report">
                    {shiftApproved ? <span className="chip chip-soft active">Approved</span> : null}
                    <button
                      type="button"
                      className="button ghost booking-board-approve-all"
                      disabled={
                        isTimeReportLocked ||
                        !shiftHasCompleteTimes ||
                        pendingApprovalKey === `${shift.id}:all` ||
                        isPending
                      }
                      onClick={() => {
                        void setAllTimeReportsApproval(shift.id, !shiftApproved);
                      }}
                    >
                      {pendingApprovalKey === `${shift.id}:all`
                        ? "Saving..."
                        : shiftApproved
                          ? "Disapprove all"
                          : "Approve all"}
                    </button>
                    {!shiftHasCompleteTimes ? (
                      <span className="chip">Times missing</span>
                    ) : null}
                  </div>
                </div>

                {shiftExpanded ? (
                  <>
                    <div className="booking-board-table">
                      <div className="booking-board-row booking-board-row-header booking-board-row-time-report">
                        <span>Staff</span>
                        <span>Edit time</span>
                        <span>Check in</span>
                        <span>Check out</span>
                        <span>Food</span>
                        <span>Approval</span>
                      </div>

                      {confirmedAssignments.map((assignment) => {
                        const person = staffById.get(assignment.staffId);
                        const lunchKey = `${shift.id}:${assignment.staffId}:lunchProvided`;
                        const dinnerKey = `${shift.id}:${assignment.staffId}:dinnerProvided`;
                        const approvalKey = `${shift.id}:${assignment.staffId}:timeReportApproved`;
                        const assignmentKey = buildAssignmentKey(shift.id, assignment.staffId);
                        const rowApproved = isAssignmentTimeReportApproved(assignment);
                        const rowHasCompleteTimes = hasCompleteTimeEntry(assignment);
                        const isEditing = editingAssignmentKey === assignmentKey;
                        const isSavingTimes = pendingTimeKey === assignmentKey;
                        const effectiveRowHasCompleteTimes = isEditing
                          ? Boolean(timeDraft.checkedIn.trim() && timeDraft.checkedOut.trim())
                          : rowHasCompleteTimes;
                        const checkoutDateLabel = formatGigDateLabel(
                          addDaysToIsoDate(
                            gigDate,
                            getCheckoutDayOffset(
                              shift,
                              timeDraft.checkedIn,
                              timeDraft.checkedOut,
                            ),
                          ),
                        );

                        return (
                          <div
                            key={assignment.staffId}
                            className="booking-board-row booking-board-row-time-report"
                          >
                            <div className="booking-board-primary">
                              <strong>{person?.displayName ?? assignment.staffId}</strong>
                              <p className="small-text">
                                {person
                                  ? `${person.region}, ${person.country}`
                                  : "Profile not found"}
                              </p>
                            </div>

                            <div className="booking-board-secondary booking-board-time-edit-cell">
                              {isEditing ? (
                                <div className="booking-board-inline-actions">
                                <button
                                  type="button"
                                  className="button ghost booking-board-approve-row"
                                  disabled={isTimeReportLocked || isSavingTimes || isPending}
                                  onClick={() => {
                                      void saveManualTimes(shift, assignment.staffId);
                                    }}
                                  >
                                    {isSavingTimes ? "Saving..." : "Save times"}
                                  </button>
                                  <button
                                    type="button"
                                    className="button ghost booking-board-approve-row"
                                    disabled={isTimeReportLocked || isSavingTimes || isPending}
                                    onClick={cancelEditingTimes}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="button ghost booking-board-approve-row"
                                  disabled={
                                    isTimeReportLocked ||
                                    isPending ||
                                    pendingApprovalKey === approvalKey
                                  }
                                  onClick={() => startEditingTimes(shift.id, assignment)}
                                >
                                  Edit time
                                </button>
                              )}
                            </div>

                            <div className="booking-board-secondary">
                              {isEditing ? (
                                <label className="booking-board-time-input-wrap">
                                  <span className="booking-board-time-input-label">
                                    Check in
                                  </span>
                                  <input
                                    type="time"
                                    className="booking-board-time-input"
                                    value={timeDraft.checkedIn}
                                    disabled={isSavingTimes}
                                    onChange={(event) => {
                                      const nextCheckedIn = event.currentTarget.value;
                                      setTimeDraft((current) => ({
                                        ...current,
                                        checkedIn: nextCheckedIn,
                                      }));
                                    }}
                                  />
                                  <span className="booking-board-time-input-note">
                                    {gigDateLabel}
                                  </span>
                                </label>
                              ) : (
                                formatTimeReportTimestamp(assignment.checkedIn)
                              )}
                            </div>

                            <div className="booking-board-secondary">
                              {isEditing ? (
                                <label className="booking-board-time-input-wrap">
                                  <span className="booking-board-time-input-label">
                                    Check out
                                  </span>
                                  <input
                                    type="time"
                                    className="booking-board-time-input"
                                    value={timeDraft.checkedOut}
                                    disabled={isSavingTimes}
                                    onChange={(event) => {
                                      const nextCheckedOut = event.currentTarget.value;
                                      setTimeDraft((current) => ({
                                        ...current,
                                        checkedOut: nextCheckedOut,
                                      }));
                                    }}
                                  />
                                  <span className="booking-board-time-input-note">
                                    {checkoutDateLabel}
                                  </span>
                                </label>
                              ) : (
                                formatTimeReportTimestamp(assignment.checkedOut)
                              )}
                            </div>

                            <div className="booking-board-secondary booking-board-food-cell">
                              <div className="booking-board-food-options">
                                <label className="booking-board-food-toggle">
                                  <input
                                    type="checkbox"
                                    checked={assignment.lunchProvided ?? false}
                                    disabled={
                                      isTimeReportLocked ||
                                      pendingFoodKey === lunchKey ||
                                      isPending
                                    }
                                    onChange={(event) => {
                                      void updateFoodStatus(
                                        shift.id,
                                        assignment.staffId,
                                        "lunchProvided",
                                        event.currentTarget.checked,
                                      );
                                    }}
                                  />
                                  <span>Lunch</span>
                                </label>

                                <label className="booking-board-food-toggle">
                                  <input
                                    type="checkbox"
                                    checked={assignment.dinnerProvided ?? false}
                                    disabled={
                                      isTimeReportLocked ||
                                      pendingFoodKey === dinnerKey ||
                                      isPending
                                    }
                                    onChange={(event) => {
                                      void updateFoodStatus(
                                        shift.id,
                                        assignment.staffId,
                                        "dinnerProvided",
                                        event.currentTarget.checked,
                                      );
                                    }}
                                  />
                                  <span>Dinner</span>
                                </label>
                              </div>
                            </div>

                            <div className="booking-board-secondary booking-board-approval-cell">
                              <div className="booking-board-approval-actions">
                                {rowApproved ? (
                                  <span className="chip chip-soft active">Approved</span>
                                ) : null}

                                <button
                                  type="button"
                                  className="button ghost booking-board-approve-row"
                                  disabled={
                                    isTimeReportLocked ||
                                    !effectiveRowHasCompleteTimes ||
                                    isSavingTimes ||
                                    pendingApprovalKey === approvalKey ||
                                    isPending
                                  }
                                  onClick={() => {
                                    if (isEditing) {
                                      void saveManualTimes(shift, assignment.staffId, {
                                        timeReportApproved: !rowApproved,
                                      });
                                      return;
                                    }

                                    void setTimeReportApproval(
                                      shift.id,
                                      assignment.staffId,
                                      !rowApproved,
                                    );
                                  }}
                                >
                                  {pendingApprovalKey === approvalKey || isSavingTimes
                                    ? "Saving..."
                                    : rowApproved
                                      ? "Disapprove"
                                      : "Approve"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {showFinalizeConfirm ? (
        <div className="confirm-modal-overlay" role="presentation">
          <div
            className="card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-time-report-title"
          >
            <div className="stack-column">
              <div>
                <p className="eyebrow">Time report</p>
                <h2 id="approve-time-report-title">Final approval</h2>
                <p className="page-subtitle">
                  Approve the full time report to generate Employment Contracts and
                  Time Reports.
                </p>
                <p className="muted">
                  By approving this time report, it becomes final. You cannot
                  withdraw it or change the time report later.
                </p>
                <p className="muted">
                  The gig date will also be locked once approved because legal payroll
                  documents and contracts will be generated from this final version.
                </p>
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setShowFinalizeConfirm(false)}
                  disabled={isFinalizingTimeReport}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void approveFullTimeReport();
                  }}
                  disabled={isFinalizingTimeReport}
                >
                  {isFinalizingTimeReport ? "Approving..." : "Approve time report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
