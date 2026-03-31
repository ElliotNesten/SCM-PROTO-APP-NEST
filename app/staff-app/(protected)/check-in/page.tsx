import Link from "next/link";

import {
  checkInToStaffAppTodayShift,
  checkOutFromStaffAppTodayShift,
} from "@/app/staff-app/actions";
import { getStaffAppAttendanceState } from "@/lib/staff-app-attendance-store";
import {
  formatStaffAppCompactDate,
  formatStaffAppDateLine,
  formatStaffAppTimestamp,
} from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppCheckInPageProps = {
  searchParams: Promise<{ status?: string }>;
};

function StaffAppClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7.5v5h4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StaffAppCheckMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m6.5 12 3.3 3.4 7.7-7.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StaffAppArrowOutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 12h10m0 0-4-4m4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getAttendanceNotice(status: string | undefined) {
  switch (status) {
    case "checked-in":
      return {
        tone: "success",
        text: "Check in saved. Your active shift is now marked as started.",
      };
    case "checked-out":
      return {
        tone: "success",
        text: "Check out saved. Your shift has been marked as completed for today.",
      };
    case "already-in":
      return {
        tone: "danger",
        text: "You are already checked in for today's shift.",
      };
    case "not-ready":
      return {
        tone: "danger",
        text: "Check out becomes available only after you have checked in.",
      };
    case "unavailable":
      return {
        tone: "danger",
        text: "Check in and check out are only available on the booked shift day.",
      };
    case "missing":
      return {
        tone: "danger",
        text: "No shift was selected for the attendance action.",
      };
    default:
      return null;
  }
}

export default async function StaffAppCheckInPage({
  searchParams,
}: StaffAppCheckInPageProps) {
  const account = await requireCurrentStaffAppAccount();
  const { status } = await searchParams;
  const attendanceState = await getStaffAppAttendanceState(account);
  const notice = getAttendanceNotice(status);

  const bannerText = attendanceState.todayShift
    ? attendanceState.checkedOutAt
      ? `Checked out at ${formatStaffAppTimestamp(attendanceState.checkedOutAt)}.`
      : attendanceState.checkedInAt
        ? `Checked in at ${formatStaffAppTimestamp(attendanceState.checkedInAt)}. Check out after the shift ends.`
        : `You can check in for ${attendanceState.todayShift.artist} today.`
    : "No shifts available to check in to today.";

  return (
    <section className="staff-app-screen staff-app-attendance-screen">
      <Link href="/staff-app/home" className="staff-app-back-link">
        Back to home
      </Link>

      <div className="staff-app-card emphasis staff-app-attendance-hero">
        <div className="staff-app-attendance-clock">
          <StaffAppClockIcon />
        </div>
        <div className="staff-app-attendance-copy">
          <p className="staff-app-kicker">Shift attendance</p>
          <h1>Check In / Check Out</h1>
          <p>
            Attendance opens on the same day as your booked shift and stays linked to that
            shift record.
          </p>
        </div>
      </div>

      <div
        className={`staff-app-inline-alert${
          attendanceState.todayShift ? (attendanceState.checkedOutAt ? " success" : "") : ""
        }`}
      >
        {bannerText}
      </div>

      {notice ? (
        <div
          className={`staff-app-inline-alert${notice.tone === "danger" ? " danger" : " success"}`}
        >
          {notice.text}
        </div>
      ) : null}

      {attendanceState.todayShift ? (
        <Link
          href={`/staff-app/shifts/${attendanceState.todayShift.id}`}
          className="staff-app-card staff-app-attendance-shift-card"
          data-text-edit-exclude="true"
        >
          <div className="staff-app-section-head compact">
            <div>
              <p className="staff-app-kicker">Today&apos;s shift</p>
              <h2>{attendanceState.todayShift.artist}</h2>
            </div>
            <span className="staff-app-badge success">{attendanceState.todayShift.status}</span>
          </div>

          <div className="staff-app-detail-grid">
            <div className="staff-app-detail-cell">
              <span>Date and time</span>
              <strong>
                {formatStaffAppDateLine(
                  attendanceState.todayShift.date,
                  attendanceState.todayShift.startTime,
                  attendanceState.todayShift.endTime,
                )}
              </strong>
            </div>
            <div className="staff-app-detail-cell">
              <span>Venue</span>
              <strong>
                {attendanceState.todayShift.arena}, {attendanceState.todayShift.city}
              </strong>
            </div>
            <div className="staff-app-detail-cell">
              <span>Role</span>
              <strong>{attendanceState.todayShift.role}</strong>
            </div>
            <div className="staff-app-detail-cell">
              <span>Manager</span>
              <strong>{attendanceState.todayShift.responsibleManager}</strong>
            </div>
          </div>
        </Link>
      ) : attendanceState.nextShift ? (
        <Link
          href={`/staff-app/shifts/${attendanceState.nextShift.id}`}
          className="staff-app-card staff-app-attendance-shift-card"
          data-text-edit-exclude="true"
        >
          <div className="staff-app-section-head compact">
            <div>
              <p className="staff-app-kicker">Next booked shift</p>
              <h2>{attendanceState.nextShift.artist}</h2>
            </div>
            <span className="staff-app-badge neutral">Upcoming</span>
          </div>

          <p className="staff-app-muted">
            Check in opens on {formatStaffAppCompactDate(attendanceState.nextShift.date)} for this
            booked assignment.
          </p>

          <div className="staff-app-detail-grid">
            <div className="staff-app-detail-cell">
              <span>Date and time</span>
              <strong>
                {formatStaffAppDateLine(
                  attendanceState.nextShift.date,
                  attendanceState.nextShift.startTime,
                  attendanceState.nextShift.endTime,
                )}
              </strong>
            </div>
            <div className="staff-app-detail-cell">
              <span>Venue</span>
              <strong>
                {attendanceState.nextShift.arena}, {attendanceState.nextShift.city}
              </strong>
            </div>
          </div>
        </Link>
      ) : (
        <div className="staff-app-empty-state">No booked shifts are available yet.</div>
      )}

      <div className="staff-app-attendance-action-grid">
        <form action={checkInToStaffAppTodayShift} className="staff-app-attendance-action-form">
          <input type="hidden" name="shiftId" value={attendanceState.todayShift?.id ?? ""} />
          <button
            type="submit"
            className="staff-app-attendance-action success"
            disabled={!attendanceState.canCheckIn}
          >
            <span className="staff-app-attendance-action-icon">
              <StaffAppCheckMarkIcon />
            </span>
            <strong>Check In</strong>
            <p>
              {attendanceState.canCheckIn
                ? "Start the active shift and save your attendance."
                : attendanceState.checkedInAt
                  ? `Saved at ${formatStaffAppTimestamp(attendanceState.checkedInAt)}`
                  : "Available on the date of your booked shift."}
            </p>
          </button>
        </form>

        <form action={checkOutFromStaffAppTodayShift} className="staff-app-attendance-action-form">
          <input type="hidden" name="shiftId" value={attendanceState.todayShift?.id ?? ""} />
          <button
            type="submit"
            className="staff-app-attendance-action danger"
            disabled={!attendanceState.canCheckOut}
          >
            <span className="staff-app-attendance-action-icon">
              <StaffAppArrowOutIcon />
            </span>
            <strong>Check Out</strong>
            <p>
              {attendanceState.canCheckOut
                ? "Close the shift after your work is completed."
                : attendanceState.checkedOutAt
                  ? `Saved at ${formatStaffAppTimestamp(attendanceState.checkedOutAt)}`
                  : "Enabled after a valid check in on the same shift day."}
            </p>
          </button>
        </form>
      </div>
    </section>
  );
}
