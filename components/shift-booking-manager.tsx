"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import type { BookingStatus } from "@/types/scm";

type BookingCandidate = {
  id: string;
  displayName: string;
  region: string;
  country: string;
  roles: string[];
  approvalStatus: string;
};

type BookingAssignment = {
  staffId: string;
  bookingStatus: BookingStatus;
};

export function ShiftBookingManager({
  gigId,
  shiftId,
  candidates,
  initialAssignments,
  assignments: controlledAssignments,
  onAssignmentsChange,
}: {
  gigId: string;
  shiftId: string;
  candidates: BookingCandidate[];
  initialAssignments: BookingAssignment[];
  assignments?: BookingAssignment[];
  onAssignmentsChange?: (assignments: BookingAssignment[]) => void;
}) {
  const router = useRouter();
  const [localAssignments, setLocalAssignments] = useState(initialAssignments);
  const [pendingStaffId, setPendingStaffId] = useState<string | null>(null);

  const activeAssignments = controlledAssignments ?? localAssignments;
  const assignmentMap = useMemo(
    () =>
      new Map(activeAssignments.map((assignment) => [assignment.staffId, assignment.bookingStatus])),
    [activeAssignments],
  );

  async function updateAssignment(staffId: string, bookingStatus: BookingStatus | null) {
    setPendingStaffId(staffId);

    try {
      const response = await fetch(`/api/gigs/${gigId}/shifts/${shiftId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ staffId, bookingStatus }),
      });

      if (!response.ok) {
        throw new Error("Could not update shift booking.");
      }

      const payload = (await response.json()) as {
        shift?: { assignments?: BookingAssignment[] };
      };

      const nextAssignments = payload.shift?.assignments ?? [];

      if (onAssignmentsChange) {
        onAssignmentsChange(nextAssignments);
      } else {
        setLocalAssignments(nextAssignments);
        startTransition(() => router.refresh());
      }
    } finally {
      setPendingStaffId(null);
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Booking</p>
          <h2>Suggested staff pool</h2>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="empty-panel">No staff are available to book for this shift yet.</div>
      ) : (
        <div className="tile-grid">
          {candidates.map((person) => {
            const currentStatus = assignmentMap.get(person.id);
            const isPending = pendingStaffId === person.id;

            return (
              <div key={person.id} className="tile staff-tile">
                <div className="row">
                  <strong>{person.displayName}</strong>
                  {currentStatus ? (
                    <StatusBadge label={currentStatus} />
                  ) : (
                    <StatusBadge label={person.approvalStatus} />
                  )}
                </div>
                <p className="muted">
                  {person.region}, {person.country}
                </p>
                <p className="small-text">{person.roles.join(", ")}</p>
                <div className="shift-booking-actions">
                  {currentStatus !== "Confirmed" ? (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={isPending}
                      onClick={() => updateAssignment(person.id, "Confirmed")}
                    >
                      {currentStatus ? "Book now" : "Book"}
                    </button>
                  ) : null}

                  {currentStatus !== "Waitlisted" ? (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={isPending}
                      onClick={() => updateAssignment(person.id, "Waitlisted")}
                    >
                      Waitlist
                    </button>
                  ) : null}

                  {currentStatus ? (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={isPending}
                      onClick={() => updateAssignment(person.id, null)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
