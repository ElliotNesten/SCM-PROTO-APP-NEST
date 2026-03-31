import Link from "next/link";
import { notFound } from "next/navigation";

import { isStaffAppShiftToday } from "@/lib/staff-app-attendance-store";
import { formatStaffAppCompactDate, getStaffAppShiftById } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppShiftDetailPageProps = {
  params: Promise<{ shiftId: string }>;
};

function StaffAppShiftMetaIcon({ kind }: { kind: "calendar" | "clock" | "pin" }) {
  if (kind === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="4"
          y="6"
          width="16"
          height="14"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8 4v4M16 4v4M4 10h16"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (kind === "clock") {
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

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20s5-4.5 5-9a5 5 0 1 0-10 0c0 4.5 5 9 5 9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="11" r="1.8" fill="currentColor" />
    </svg>
  );
}

function StaffAppScheduleArtwork({
  imageUrl,
  title,
}: {
  imageUrl?: string;
  title: string;
}) {
  if (imageUrl) {
    return (
      <div className="staff-app-schedule-artwork detail">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} />
      </div>
    );
  }

  return (
    <div className="staff-app-schedule-artwork detail fallback">
      <span>{title.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export default async function StaffAppShiftDetailPage({
  params,
}: StaffAppShiftDetailPageProps) {
  const { shiftId } = await params;
  const account = await requireCurrentStaffAppAccount();
  const shift = await getStaffAppShiftById(shiftId, account);

  if (!shift) {
    notFound();
  }

  const isTodayShift = isStaffAppShiftToday(shift.date);

  return (
    <section className="staff-app-screen staff-app-shift-sheet-screen">
      <div className="staff-app-shift-sheet">
        <div className="staff-app-shift-sheet-head">
          <strong>Event (1)</strong>
          <Link href="/staff-app/schedule" className="staff-app-shift-sheet-close" aria-label="Close">
            ×
          </Link>
        </div>

        <div className="staff-app-shift-sheet-hero">
          <StaffAppScheduleArtwork imageUrl={shift.imageUrl} title={shift.artist} />

          <div className="staff-app-shift-sheet-copy">
            <h1>
              {shift.artist} [{shift.role}]
            </h1>

            <div className="staff-app-shift-sheet-meta">
              <span>
                <StaffAppShiftMetaIcon kind="calendar" />
                {formatStaffAppCompactDate(shift.date)}
              </span>
              <span>
                <StaffAppShiftMetaIcon kind="clock" />
                {shift.startTime} - {shift.endTime}
              </span>
              <span>
                <StaffAppShiftMetaIcon kind="pin" />
                {shift.arena}
              </span>
            </div>
          </div>
        </div>

        <div className="staff-app-shift-sheet-alert">
          Times are preliminary: {shift.startTime} - {shift.endTime}
        </div>

        <div className="staff-app-shift-sheet-section">
          <span>Important information before the shift:</span>
          <p>{shift.practicalNotes}</p>
        </div>

        <div className="staff-app-shift-sheet-section">
          <span>Additional information:</span>
          <p>Meeting point: {shift.meetingPoint}</p>
          <p>Shift status: {shift.status}</p>
        </div>

        <div className="staff-app-shift-sheet-section">
          <span>Contact:</span>
          <p>{shift.responsibleManager}</p>
          {shift.threadId ? (
            <Link href={`/staff-app/messages/${shift.threadId}`} className="staff-app-inline-link">
              Open shift chat
            </Link>
          ) : null}
        </div>

        <div className="staff-app-action-stack">
          {isTodayShift ? (
            <Link href="/staff-app/check-in" className="staff-app-button secondary">
              Open check in / out
            </Link>
          ) : null}
          {shift.hasRelatedDocuments ? (
            <Link href="/staff-app/documents" className="staff-app-button secondary">
              View related documents
            </Link>
          ) : null}
          <Link href="/staff-app/schedule" className="staff-app-button">
            OK
          </Link>
        </div>
      </div>
    </section>
  );
}
