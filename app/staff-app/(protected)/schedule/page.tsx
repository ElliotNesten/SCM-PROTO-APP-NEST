import Link from "next/link";

import { formatStaffAppCompactDate, getStaffAppSchedule } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";
import type { StaffAppScheduledShift } from "@/types/staff-app";

function StaffAppCalendarIcon() {
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
        d="M8 4v4M16 4v4M4 10h16m-10 3h2m2 0h2m-6 3h2m2 0h2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StaffAppChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
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
      <div className="staff-app-schedule-artwork">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} />
      </div>
    );
  }

  return (
    <div className="staff-app-schedule-artwork fallback">
      <span>{title.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

function formatShiftDateTime(shift: StaffAppScheduledShift) {
  return `${formatStaffAppCompactDate(shift.date)} | ${shift.startTime} - ${shift.endTime}`;
}

function formatCalendarMonth(date: string) {
  const [year, month] = date.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function buildScheduleCalendar(referenceDate: string, schedule: StaffAppScheduledShift[]) {
  const [year, month, day] = referenceDate.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const shiftDays = new Set(
    schedule
      .filter((shift) => shift.date.startsWith(`${year}-${String(month).padStart(2, "0")}`))
      .map((shift) => Number(shift.date.split("-")[2])),
  );

  const cells: Array<
    | { key: string; muted: true }
    | { key: string; day: number; selected: boolean; hasShift: boolean }
  > = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push({ key: `empty-${index}`, muted: true });
  }

  for (let currentDay = 1; currentDay <= daysInMonth; currentDay += 1) {
    cells.push({
      key: `day-${currentDay}`,
      day: currentDay,
      selected: currentDay === day,
      hasShift: shiftDays.has(currentDay),
    });
  }

  return {
    monthLabel: formatCalendarMonth(referenceDate),
    cells,
  };
}

export default async function StaffAppSchedulePage() {
  const account = await requireCurrentStaffAppAccount();
  const schedule = await getStaffAppSchedule(account);
  const featuredShift = schedule[0] ?? null;

  if (!featuredShift) {
    return (
      <section className="staff-app-screen staff-app-schedule-screen">
        <div className="staff-app-page-head">
          <h1>My Schedule</h1>
          <p>No booked shifts have been assigned yet.</p>
        </div>
        <div className="staff-app-empty-state">Booked events will appear here as soon as they are confirmed.</div>
      </section>
    );
  }

  const calendar = buildScheduleCalendar(featuredShift.date, schedule);

  return (
    <section className="staff-app-screen staff-app-schedule-screen">
      <div className="staff-app-page-head">
        <h1>My Schedule</h1>
      </div>

      <Link
        href={`/staff-app/shifts/${featuredShift.id}`}
        className="staff-app-card staff-app-schedule-summary-card"
      >
        <span className="staff-app-schedule-summary-icon">
          <StaffAppCalendarIcon />
        </span>
        <div className="staff-app-schedule-summary-copy">
          <strong>My Shifts</strong>
          <p>Upcoming work:</p>
          <p>{schedule.length} upcoming shift{schedule.length === 1 ? "" : "s"}</p>
          <p>Manage your shifts</p>
        </div>
        <span className="staff-app-schedule-chevron">
          <StaffAppChevronIcon />
        </span>
      </Link>

      <Link
        href={`/staff-app/shifts/${featuredShift.id}`}
        className="staff-app-card staff-app-schedule-feature-card"
        data-text-edit-exclude="true"
      >
        <StaffAppScheduleArtwork
          imageUrl={featuredShift.imageUrl}
          title={featuredShift.artist}
        />

        <div className="staff-app-schedule-feature-copy">
          <strong>
            {featuredShift.artist} [{featuredShift.role}]
          </strong>
          <p>{formatShiftDateTime(featuredShift)}</p>
          <p>{featuredShift.arena}</p>
        </div>

        <span className="staff-app-schedule-feature-toggle">
          <StaffAppChevronIcon />
        </span>
      </Link>

      <div className="staff-app-card staff-app-schedule-calendar-card">
        <div className="staff-app-schedule-calendar-head">
          <span className="staff-app-schedule-calendar-nav">
            <StaffAppChevronIcon />
          </span>
          <strong>{calendar.monthLabel}</strong>
          <span className="staff-app-schedule-calendar-nav next">
            <StaffAppChevronIcon />
          </span>
        </div>

        <div className="staff-app-schedule-weekdays">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="staff-app-schedule-calendar-grid">
          {calendar.cells.map((cell) =>
            "muted" in cell ? (
              <span key={cell.key} className="staff-app-schedule-calendar-cell muted" />
            ) : (
              <span
                key={cell.key}
                className={`staff-app-schedule-calendar-cell${
                  cell.selected ? " selected" : ""
                }${cell.hasShift ? " has-shift" : ""}`}
              >
                {cell.day}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
