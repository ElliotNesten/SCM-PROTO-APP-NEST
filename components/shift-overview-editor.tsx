"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import type { BookingStatus, Shift } from "@/types/scm";

type ShiftRoleOption = "Stand Leader" | "Seller" | "Runner" | "Other";

type ShiftCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  region: string;
  country: string;
  roles: string[];
  approvalStatus: string;
  appliedAt?: string;
  manualBookingEligible?: boolean;
  priorityLevelIgnored?: boolean;
};

type ShiftOverviewEditorProps = {
  gigId: string;
  gigArtist: string;
  dateLabel: string;
  shift: Shift;
  candidates: ShiftCandidate[];
};

type ShiftFormState = {
  role: ShiftRoleOption;
  customRole: string;
  priorityLevel: number;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  notes: string;
};

type ShiftPersonSummary = {
  id: string;
  firstName: string;
  lastName: string;
  region: string;
  country: string;
};

function buildInitialState(shift: Shift): ShiftFormState {
  const isDefaultRole =
    shift.role === "Stand Leader" ||
    shift.role === "Seller" ||
    shift.role === "Runner";

  return {
    role: isDefaultRole ? (shift.role as ShiftRoleOption) : "Other",
    customRole: isDefaultRole ? "" : shift.role,
    priorityLevel: shift.priorityLevel,
    startTime: shift.startTime,
    endTime: shift.endTime,
    requiredStaff: shift.requiredStaff,
    notes: shift.notes,
  };
}

function sortPeopleByName(people: ShiftPersonSummary[]) {
  return [...people].sort((left, right) =>
    `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`),
  );
}

function formatAppliedAt(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getStatusWeight(status: BookingStatus | undefined) {
  if (status === "Confirmed") {
    return 0;
  }

  if (status === "Waitlisted") {
    return 1;
  }

  if (status === "Pending") {
    return 2;
  }

  return 3;
}

export function ShiftOverviewEditor({
  gigId,
  gigArtist,
  dateLabel,
  shift,
  candidates,
}: ShiftOverviewEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<ShiftFormState>(() => buildInitialState(shift));
  const [assignments, setAssignments] = useState(shift.assignments);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingStaffId, setPendingStaffId] = useState<string | null>(null);
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
  const [selectedManualStaffId, setSelectedManualStaffId] = useState<string>(
    () => candidates.find((candidate) => !candidate.appliedAt)?.id ?? "",
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(buildInitialState(shift));
    setAssignments(shift.assignments);
  }, [shift]);

  useEffect(() => {
    const nextManualCandidateId =
      candidates.find((candidate) => !candidate.appliedAt)?.id ?? "";

    setSelectedManualStaffId((current) => {
      if (!current) {
        return nextManualCandidateId;
      }

      return candidates.some(
        (candidate) => candidate.id === current && !candidate.appliedAt,
      )
        ? current
        : nextManualCandidateId;
    });
  }, [candidates]);

  const candidateById = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  );
  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.staffId, assignment.bookingStatus])),
    [assignments],
  );
  const lockedRoleLabel = form.role === "Other" ? form.customRole : form.role;
  const bookedPeople = useMemo(
    () =>
      sortPeopleByName(
        assignments
          .filter((assignment) => assignment.bookingStatus === "Confirmed")
          .flatMap((assignment) => {
            const person = candidateById.get(assignment.staffId);

            if (!person) {
              return [];
            }

            return [
              {
                id: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                region: person.region,
                country: person.country,
              },
            ];
          }),
      ),
    [assignments, candidateById],
  );
  const waitlistedPeople = useMemo(
    () =>
      sortPeopleByName(
        assignments
          .filter((assignment) => assignment.bookingStatus === "Waitlisted")
          .flatMap((assignment) => {
            const person = candidateById.get(assignment.staffId);

            if (!person) {
              return [];
            }

            return [
              {
                id: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                region: person.region,
                country: person.country,
              },
            ];
          }),
      ),
    [assignments, candidateById],
  );
  const confirmedCount = bookedPeople.length;
  const waitlistCount = waitlistedPeople.length;
  const openSlots = Math.max(form.requiredStaff - confirmedCount, 0);
  const applicants = useMemo(
    () =>
      [...candidates]
        .filter((candidate) => Boolean(candidate.appliedAt))
        .sort((left, right) => {
          const statusDifference =
            getStatusWeight(assignmentMap.get(left.id)) -
            getStatusWeight(assignmentMap.get(right.id));

          if (statusDifference !== 0) {
            return statusDifference;
          }

          if (left.appliedAt && right.appliedAt && left.appliedAt !== right.appliedAt) {
            return right.appliedAt.localeCompare(left.appliedAt);
          }

          return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`);
        }),
    [assignmentMap, candidates],
  );
  const manualCandidates = useMemo(
    () =>
      [...candidates]
        .filter(
          (candidate) =>
            !candidate.appliedAt &&
            (candidate.manualBookingEligible || assignmentMap.has(candidate.id)),
        )
        .sort((left, right) => {
          const statusDifference =
            getStatusWeight(assignmentMap.get(left.id)) -
            getStatusWeight(assignmentMap.get(right.id));

          if (statusDifference !== 0) {
            return statusDifference;
          }

          return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`);
        }),
    [assignmentMap, candidates],
  );
  const selectedManualCandidate = useMemo(
    () =>
      manualCandidates.find((candidate) => candidate.id === selectedManualStaffId) ??
      manualCandidates[0] ??
      null,
    [manualCandidates, selectedManualStaffId],
  );
  const applicantCount = applicants.length;

  function updateField<Key extends keyof ShiftFormState>(
    key: Key,
    value: ShiftFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSave() {
    setSaveMessage(null);

    if (form.requiredStaff < 1) {
      setSaveMessage("Staff needed must be at least 1.");
      return;
    }

    if (form.priorityLevel < 1 || form.priorityLevel > 5) {
      setSaveMessage("Priority level must be between 1 and 5.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/gigs/${gigId}/shifts/${shift.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priorityLevel: form.priorityLevel,
          requiredStaff: form.requiredStaff,
          startTime: form.startTime,
          endTime: form.endTime,
          notes: form.notes,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setSaveMessage(payload?.error ?? "Could not save shift details.");
        return;
      }

      setSaveMessage("Shift details saved.");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setSaveMessage("Could not save shift details.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateAssignment(
    staffId: string,
    bookingStatus: BookingStatus | null,
    options?: {
      allowManualOverride?: boolean;
    },
  ) {
    setPendingStaffId(staffId);
    setBookingMessage(null);

    try {
      const response = await fetch(`/api/gigs/${gigId}/shifts/${shift.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staffId,
          bookingStatus,
          allowManualOverride: options?.allowManualOverride === true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            shift?: { assignments?: typeof shift.assignments };
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not update shift booking.");
      }

      setAssignments(payload?.shift?.assignments ?? []);
    } catch (error) {
      setBookingMessage(
        error instanceof Error ? error.message : "Could not update shift booking.",
      );
    } finally {
      setPendingStaffId(null);
    }
  }

  return (
    <section className="stack-column">
      <div className="content-grid shift-detail-overview-layout">
        <div className="card shift-detail-editor-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Shift overview</p>
              <h2>Role, time and staffing</h2>
            </div>
            <span className="chip">Open slots {openSlots}</span>
          </div>

          <div className="field-grid shift-detail-editor-grid">
            <div className="field">
              <span>Role</span>
              <input type="text" readOnly value={lockedRoleLabel} />
            </div>

            <label className="field">
              <span>Priority level</span>
              <select
                value={String(form.priorityLevel)}
                onChange={(event) =>
                  updateField("priorityLevel", Number(event.currentTarget.value))
                }
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </label>

            <div className="field full-width">
              <span>Time</span>
              <div className="overview-paired-fields shift-detail-time-grid">
                <label className="overview-stack-subfield">
                  <span>Start</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      updateField("startTime", event.currentTarget.value)
                    }
                  />
                </label>

                <label className="overview-stack-subfield">
                  <span>End</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      updateField("endTime", event.currentTarget.value)
                    }
                  />
                </label>
              </div>
            </div>

            <label className="field">
              <span>Staff needed</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={form.requiredStaff}
                onChange={(event) =>
                  updateField("requiredStaff", Number(event.currentTarget.value) || 0)
                }
              />
            </label>

            <label className="field">
              <span>Open slots</span>
              <input type="text" readOnly value={String(openSlots)} />
            </label>

            <label className="field">
              <span>Booked</span>
              <input type="text" readOnly value={String(confirmedCount)} />
            </label>

            <label className="field">
              <span>Waitlist</span>
              <input type="text" readOnly value={String(waitlistCount)} />
            </label>

            <label className="field full-width">
              <span>Comment</span>
              <textarea
                rows={6}
                value={form.notes}
                onChange={(event) => updateField("notes", event.currentTarget.value)}
              />
            </label>

            <div className="field full-width shift-detail-context-copy">
              <span>Gig</span>
              <p className="muted">
                <strong>{gigArtist}</strong> | {dateLabel}
              </p>
            </div>
          </div>

          <div className="overview-editor-actions">
            {saveMessage ? (
              <p className="small-text equipment-save-message">{saveMessage}</p>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="button"
              disabled={isSaving || isPending}
              onClick={() => {
                void handleSave();
              }}
            >
              {isSaving || isPending ? "Saving..." : "Save shift"}
            </button>
          </div>
        </div>

        <div className="card shift-detail-booking-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Applications</p>
              <h2>Applicants and assignments</h2>
            </div>
            <div className="section-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  setIsManualBookingOpen((current) => !current);
                }}
              >
                {isManualBookingOpen ? "Close manual booking" : "Manual booking"}
              </button>
              <span className="chip">
                {applicantCount === 1 ? "1 applicant" : `${applicantCount} applicants`}
              </span>
            </div>
          </div>

          <p className="muted shift-detail-booking-copy">
            Only staff who have clicked apply in the STAFF app are shown here. Use
            manual booking if SCM wants to place another eligible person directly on
            the shift.
          </p>

          {bookingMessage ? <p className="form-error">{bookingMessage}</p> : null}

          {isManualBookingOpen ? (
            <div className="new-shift-panel">
              <div className="new-shift-panel-header">
                <strong>Manual booking</strong>
                <p className="helper-caption">
                  Select approved staff who match this shift's country, region,
                  and role permission. Priority level is ignored in manual
                  booking.
                </p>
              </div>

              {manualCandidates.length === 0 ? (
                <div className="empty-panel">
                  No approved staff match this shift's country, region, and role
                  permission right now.
                </div>
              ) : (
                <>
                  <label className="field">
                    <span>Approved staff</span>
                    <select
                      value={selectedManualCandidate?.id ?? ""}
                      onChange={(event) => {
                        setSelectedManualStaffId(event.currentTarget.value);
                      }}
                    >
                      {manualCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.firstName} {candidate.lastName} | {candidate.region}, {candidate.country}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedManualCandidate ? (
                    <article className="tile staff-tile shift-detail-candidate-card">
                      <div className="shift-detail-candidate-head">
                        <div className="shift-detail-candidate-copy">
                          <strong>{selectedManualCandidate.firstName} {selectedManualCandidate.lastName}</strong>
                          <p className="muted">
                            {selectedManualCandidate.region}, {selectedManualCandidate.country}
                          </p>
                        </div>

                        <div className="shift-detail-candidate-badges">
                          <StatusBadge
                            label={
                              assignmentMap.get(selectedManualCandidate.id) ??
                              selectedManualCandidate.approvalStatus
                            }
                          />
                        </div>
                      </div>

                      <p className="small-text">
                        {selectedManualCandidate.roles.join(", ")}
                      </p>

                      {selectedManualCandidate.manualBookingEligible === false ? (
                        <p className="small-text">
                          This person no longer matches the manual booking rules
                          for this shift. You can remove the assignment, but
                          they cannot be booked again from this list.
                        </p>
                      ) : selectedManualCandidate.priorityLevelIgnored ? (
                        <p className="small-text">
                          Eligible for manual booking. Priority level is ignored
                          here.
                        </p>
                      ) : (
                        <p className="small-text">Eligible for direct booking.</p>
                      )}

                      <div className="shift-booking-actions">
                        {assignmentMap.get(selectedManualCandidate.id) !== "Confirmed" ? (
                          <button
                            type="button"
                            className="button ghost"
                            disabled={
                              pendingStaffId === selectedManualCandidate.id ||
                              selectedManualCandidate.manualBookingEligible === false
                            }
                            onClick={() => {
                              void updateAssignment(
                                selectedManualCandidate.id,
                                "Confirmed",
                                { allowManualOverride: true },
                              );
                            }}
                          >
                            {assignmentMap.get(selectedManualCandidate.id) ? "Book now" : "Book"}
                          </button>
                        ) : null}

                        {assignmentMap.get(selectedManualCandidate.id) ? (
                          <button
                            type="button"
                            className="button ghost"
                            disabled={pendingStaffId === selectedManualCandidate.id}
                            onClick={() => {
                              void updateAssignment(selectedManualCandidate.id, null);
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {applicants.length === 0 ? (
            <div className="empty-panel">
              No one has applied for this shift in the STAFF app yet.
            </div>
          ) : (
            <div className="shift-detail-candidate-list">
              {applicants.map((candidate) => {
                const currentStatus = assignmentMap.get(candidate.id);
                const isActionPending = pendingStaffId === candidate.id;

                return (
                  <article
                    key={candidate.id}
                    className="tile staff-tile shift-detail-candidate-card"
                  >
                    <div className="shift-detail-candidate-head">
                      <div className="shift-detail-candidate-copy">
                        <strong>{candidate.firstName} {candidate.lastName}</strong>
                        <p className="muted">
                          {candidate.region}, {candidate.country}
                        </p>
                      </div>

                      <div className="shift-detail-candidate-badges">
                        {candidate.appliedAt && !currentStatus ? (
                          <StatusBadge label="Applicant" />
                        ) : null}
                        <StatusBadge
                          label={currentStatus ?? candidate.approvalStatus}
                        />
                      </div>
                    </div>

                    <p className="small-text">{candidate.roles.join(", ")}</p>

                    {candidate.appliedAt ? (
                      <p className="shift-detail-application-time">
                        Applied {formatAppliedAt(candidate.appliedAt)}
                      </p>
                    ) : null}

                    <div className="shift-booking-actions">
                      {currentStatus !== "Confirmed" ? (
                        <button
                          type="button"
                          className="button ghost"
                          disabled={isActionPending}
                          onClick={() => {
                            void updateAssignment(candidate.id, "Confirmed");
                          }}
                        >
                          {currentStatus ? "Book now" : "Book"}
                        </button>
                      ) : null}

                      {currentStatus !== "Waitlisted" ? (
                        <button
                          type="button"
                          className="button ghost"
                          disabled={isActionPending}
                          onClick={() => {
                            void updateAssignment(candidate.id, "Waitlisted");
                          }}
                        >
                          Waitlist
                        </button>
                      ) : null}

                      {currentStatus ? (
                        <button
                          type="button"
                          className="button ghost"
                          disabled={isActionPending}
                          onClick={() => {
                            void updateAssignment(candidate.id, null);
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="content-grid shift-detail-secondary-layout">
        <section className="card shift-detail-roster-card">
          <div className="section-head compact">
            <div>
              <p className="eyebrow">Booked staff</p>
              <h3>Confirmed</h3>
            </div>
            <span className="chip">{confirmedCount} booked</span>
          </div>

          {bookedPeople.length === 0 ? (
            <div className="empty-panel">No one is booked yet. Use the booking tab to assign staff.</div>
          ) : (
            <div className="shift-detail-roster-list">
              {bookedPeople.map((person) => (
                <article key={person.id} className="list-row shift-detail-roster-row">
                  <div>
                    <strong>{person.firstName} {person.lastName}</strong>
                    <p className="muted">
                      {person.region}, {person.country}
                    </p>
                  </div>
                  <span className="chip chip-soft">Confirmed</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card shift-detail-roster-card">
          <div className="section-head compact">
            <div>
              <p className="eyebrow">Waitlist</p>
              <h3>Standby</h3>
            </div>
            <span className="chip">{waitlistCount} waitlisted</span>
          </div>

          {waitlistedPeople.length === 0 ? (
            <div className="empty-panel">No one is on the waitlist yet.</div>
          ) : (
            <div className="shift-detail-roster-list">
              {waitlistedPeople.map((person) => (
                <article key={person.id} className="list-row shift-detail-roster-row">
                  <div>
                    <strong>{person.firstName} {person.lastName}</strong>
                    <p className="muted">
                      {person.region}, {person.country}
                    </p>
                  </div>
                  <span className="chip chip-soft">Waitlisted</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
