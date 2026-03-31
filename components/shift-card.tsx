import Link from "next/link";

import type { Shift } from "@/types/scm";

import { StatusBadge } from "@/components/status-badge";

function getConfirmedCount(shift: Shift) {
  return shift.assignments.filter((assignment) => assignment.bookingStatus === "Confirmed").length;
}

function getWaitlistCount(shift: Shift) {
  return shift.assignments.filter((assignment) => assignment.bookingStatus === "Waitlisted").length;
}

function getOpenSlots(shift: Shift) {
  return Math.max(shift.requiredStaff - getConfirmedCount(shift), 0);
}

type ShiftCardProps = {
  shift: Shift;
  href?: string;
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
};

export function ShiftCard({ shift, href, isActive = false, onClick, onDelete }: ShiftCardProps) {
  const confirmed = getConfirmedCount(shift);
  const waitlist = getWaitlistCount(shift);
  const openSlots = getOpenSlots(shift);

  const content = (
    <>
      <div className="row">
        <StatusBadge label={shift.role} tone="neutral" />
        <span className="shift-card-priority">Priority {shift.priorityLevel}</span>
      </div>

      <h3>
        {shift.startTime} to {shift.endTime}
      </h3>
      <p className="muted">{shift.notes}</p>

      <div className="stats-grid compact">
        <div className="stat-box">
          <small>Required</small>
          <strong>{shift.requiredStaff}</strong>
        </div>
        <div className="stat-box">
          <small>Booked</small>
          <strong>{confirmed}</strong>
        </div>
      </div>

      <div className="row footer-row">
        <span className="muted small-text">Open slots {openSlots}</span>
        <span className="muted small-text">Waitlist {waitlist}</span>
      </div>
    </>
  );

  if (onClick || onDelete || href) {
    return (
      <article className={`card shift-card shift-card-shell ${isActive ? "active" : ""}`}>
        {href ? (
          <Link href={href} className="shift-card-main shift-card-link">
            {content}
          </Link>
        ) : (
          <button
            type="button"
            className="shift-card-main"
            onClick={onClick}
          >
            {content}
          </button>
        )}

        {onDelete ? (
          <div className="shift-card-actions">
            <button
              type="button"
              className="shift-card-delete"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              Delete shift
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <Link href={href ?? `/gigs/${shift.gigId}/shifts/${shift.id}`} className="card shift-card">
      {content}
    </Link>
  );
}
