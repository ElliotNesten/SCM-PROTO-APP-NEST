"use client";

import Link from "next/link";
import { useState } from "react";

import type { Gig } from "@/types/scm";

const calendarWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function normalizeDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getGigDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return normalizeDate(new Date(year, month - 1, day));
}

function getInitialCalendarMonth(sourceGigs: Gig[]) {
  const sortedGigs = [...sourceGigs].sort((a, b) => a.date.localeCompare(b.date));
  if (sortedGigs.length === 0) return normalizeDate(new Date());

  const today = normalizeDate(new Date());
  const next = sortedGigs.find((g) => getGigDate(g.date).getTime() >= today.getTime()) ?? sortedGigs[sortedGigs.length - 1];
  const target = getGigDate(next.date);
  return new Date(target.getFullYear(), target.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getIsoWeekNumber(date: Date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function buildCalendarRows(viewMonth: Date, gigs: Gig[]) {
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  gridStart.setDate(monthStart.getDate() - mondayOffset);

  const gigMap = new Map<string, Gig[]>();
  gigs.forEach((gig) => {
    const existing = gigMap.get(gig.date) ?? [];
    existing.push(gig);
    gigMap.set(gig.date, existing);
  });

  return Array.from({ length: 6 }, (_, weekIndex) => {
    const weekStart = new Date(gridStart);
    weekStart.setDate(gridStart.getDate() + weekIndex * 7);
    return {
      week: getIsoWeekNumber(weekStart),
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + dayIndex);
        const key = formatDateKey(dayDate);
        return {
          key,
          label: dayDate.getDate(),
          inMonth: dayDate.getMonth() === viewMonth.getMonth(),
          gigs: gigMap.get(key) ?? [],
        };
      }),
    };
  });
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

export function CalendarClient({ gigs }: { gigs: Gig[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const baseMonth = getInitialCalendarMonth(gigs);
  const calendarMonth = addMonths(baseMonth, monthOffset);
  const calendarRows = buildCalendarRows(calendarMonth, gigs);

  return (
    <div className="calendar-page-wrap">
      <div className="calendar-head">
        <h2>{formatMonthLabel(calendarMonth)}</h2>
        <div className="calendar-nav">
          <button type="button" aria-label="Previous month" onClick={() => setMonthOffset((n) => n - 1)}>
            &lt;
          </button>
          <button type="button" aria-label="Next month" onClick={() => setMonthOffset((n) => n + 1)}>
            &gt;
          </button>
        </div>
      </div>

      <div className="calendar-grid calendar-grid-head">
        <span />
        {calendarWeekdays.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="calendar-body">
        {calendarRows.map((row) => (
          <div key={row.week} className="calendar-grid calendar-grid-row">
            <span className="calendar-week">{row.week}</span>
            {row.days.map((day) => (
              <div
                key={day.key}
                className={`calendar-day-cell${day.inMonth ? "" : " outside-month"}${day.gigs.length > 0 ? " has-gigs" : ""}`}
              >
                <span className="calendar-day-number">{day.label}</span>
                <div className="calendar-day-gigs">
                  {day.gigs.slice(0, 3).map((gig) => (
                    <Link key={gig.id} href={`/gigs/${gig.id}`} className="calendar-gig-button">
                      {gig.artist}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
