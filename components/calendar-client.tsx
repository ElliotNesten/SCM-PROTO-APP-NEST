"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Gig, GigOverviewIndicator } from "@/types/scm";

const calendarWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const countryOptions = ["Sweden", "Norway", "Denmark", "Finland"] as const;

const progressOptions: { label: string; value: GigOverviewIndicator | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Identified", value: "identified" },
  { label: "In Progress", value: "inProgress" },
  { label: "Confirmed", value: "confirmed" },
  { label: "No merch", value: "noMerch" },
];

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

function formatFullDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function getUniqueValues(gigs: Gig[], accessor: (gig: Gig) => string): string[] {
  const values = new Set<string>();
  for (const gig of gigs) {
    const value = accessor(gig).trim();
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

interface CalendarFilters {
  country: string;
  progress: string;
  scmRep: string;
  arena: string;
  artist: string;
  city: string;
}

const defaultFilters: CalendarFilters = {
  country: "all",
  progress: "all",
  scmRep: "all",
  arena: "all",
  artist: "all",
  city: "all",
};

function applyFilters(gigs: Gig[], filters: CalendarFilters): Gig[] {
  return gigs.filter((gig) => {
    if (filters.country !== "all" && gig.country !== filters.country) return false;
    if (filters.progress !== "all" && (gig.overviewIndicator ?? "") !== filters.progress) return false;
    if (filters.scmRep !== "all" && gig.scmRepresentative !== filters.scmRep) return false;
    if (filters.arena !== "all" && gig.arena !== filters.arena) return false;
    if (filters.artist !== "all" && gig.artist !== filters.artist) return false;
    if (filters.city !== "all" && gig.city !== filters.city) return false;
    return true;
  });
}

export function CalendarClient({ gigs }: { gigs: Gig[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(formatDateKey(normalizeDate(new Date())));
  const [filters, setFilters] = useState<CalendarFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);

  const filterOptions = useMemo(() => ({
    scmReps: getUniqueValues(gigs, (g) => g.scmRepresentative),
    arenas: getUniqueValues(gigs, (g) => g.arena),
    artists: getUniqueValues(gigs, (g) => g.artist),
    cities: getUniqueValues(gigs, (g) => g.city),
  }), [gigs]);

  const filteredGigs = useMemo(() => applyFilters(gigs, filters), [gigs, filters]);
  const activeFilterCount = Object.values(filters).filter((v) => v !== "all").length;

  const baseMonth = getInitialCalendarMonth(gigs);
  const calendarMonth = addMonths(baseMonth, monthOffset);
  const calendarRows = buildCalendarRows(calendarMonth, filteredGigs);
  const todayKey = formatDateKey(normalizeDate(new Date()));

  const todayMonth = normalizeDate(new Date());
  const isCurrentMonth =
    calendarMonth.getFullYear() === todayMonth.getFullYear() &&
    calendarMonth.getMonth() === todayMonth.getMonth();

  const selectedGigs = selectedDay
    ? filteredGigs.filter((g) => g.date === selectedDay)
    : [];

  function goToToday() {
    const today = normalizeDate(new Date());
    const todayMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const baseMonthStart = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
    const diff = (todayMonthStart.getFullYear() - baseMonthStart.getFullYear()) * 12 +
      (todayMonthStart.getMonth() - baseMonthStart.getMonth());
    setMonthOffset(diff);
    setSelectedDay(todayKey);
  }

  function updateFilter(key: keyof CalendarFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(defaultFilters);
  }

  return (
    <div className="calendar-page-wrap">
      <div className="calendar-head">
        <h2>{formatMonthLabel(calendarMonth)}</h2>
        <div className="calendar-nav">
          <button
            type="button"
            className={`calendar-filter-toggle${activeFilterCount > 0 ? " has-active" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            {activeFilterCount > 0 && <span className="calendar-filter-badge">{activeFilterCount}</span>}
          </button>
          {!isCurrentMonth && (
            <button type="button" className="calendar-today-btn" onClick={goToToday}>
              Today
            </button>
          )}
          <button type="button" aria-label="Previous month" onClick={() => { setMonthOffset((n) => n - 1); setSelectedDay(null); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button type="button" aria-label="Next month" onClick={() => { setMonthOffset((n) => n + 1); setSelectedDay(null); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="calendar-filters">
          <div className="calendar-filters-grid">
            <label className="calendar-filter-field">
              <span>Country</span>
              <select value={filters.country} onChange={(e) => updateFilter("country", e.target.value)}>
                <option value="all">All countries</option>
                {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="calendar-filter-field">
              <span>Progress</span>
              <select value={filters.progress} onChange={(e) => updateFilter("progress", e.target.value)}>
                {progressOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label className="calendar-filter-field">
              <span>SCM Onsite Rep</span>
              <select value={filters.scmRep} onChange={(e) => updateFilter("scmRep", e.target.value)}>
                <option value="all">All reps</option>
                {filterOptions.scmReps.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="calendar-filter-field">
              <span>Arena</span>
              <select value={filters.arena} onChange={(e) => updateFilter("arena", e.target.value)}>
                <option value="all">All arenas</option>
                {filterOptions.arenas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="calendar-filter-field">
              <span>Artist</span>
              <select value={filters.artist} onChange={(e) => updateFilter("artist", e.target.value)}>
                <option value="all">All artists</option>
                {filterOptions.artists.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="calendar-filter-field">
              <span>City</span>
              <select value={filters.city} onChange={(e) => updateFilter("city", e.target.value)}>
                <option value="all">All cities</option>
                {filterOptions.cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          {activeFilterCount > 0 && (
            <button type="button" className="calendar-clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="calendar-grid calendar-grid-head">
        <span className="calendar-week-header">W</span>
        {calendarWeekdays.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="calendar-body">
        {calendarRows.map((row) => (
          <div key={row.week} className="calendar-grid calendar-grid-row">
            <span className="calendar-week">{row.week}</span>
            {row.days.map((day) => {
              const isToday = day.key === todayKey;
              const isSelected = day.key === selectedDay;
              const cellClasses = [
                "calendar-day-cell",
                !day.inMonth && "outside-month",
                day.gigs.length > 0 && "has-gigs",
                isToday && "is-today",
                isSelected && "is-selected",
              ].filter(Boolean).join(" ");

              return (
                <button
                  key={day.key}
                  type="button"
                  className={cellClasses}
                  onClick={() => setSelectedDay(day.key === selectedDay ? null : day.key)}
                >
                  <span className={`calendar-day-number${isToday ? " today-marker" : ""}`}>
                    {day.label}
                  </span>
                  {day.gigs.length > 0 && (
                    <div className="calendar-day-dots">
                      {day.gigs.slice(0, 3).map((gig) => (
                        <span key={gig.id} className="calendar-dot" title={gig.artist} />
                      ))}
                      {day.gigs.length > 3 && (
                        <span className="calendar-dot-overflow">+{day.gigs.length - 3}</span>
                      )}
                    </div>
                  )}
                  {day.gigs.length > 0 && (
                    <span className="calendar-gig-count">{day.gigs.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selectedDay && (
        <div className="calendar-day-detail">
          <h3>{formatFullDate(selectedDay)}</h3>
          {selectedGigs.length === 0 ? (
            <p className="calendar-detail-empty">No gigs on this day.</p>
          ) : (
            <div className="calendar-detail-list">
              {selectedGigs.map((gig) => (
                <Link key={gig.id} href={`/gigs/${gig.id}`} className="calendar-detail-row">
                  <div className="calendar-detail-info">
                    <span className="calendar-detail-artist">{gig.artist}</span>
                    <span className="calendar-detail-venue">
                      {gig.arena ? `${gig.arena}, ${gig.city}` : gig.city || gig.country}
                    </span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="calendar-detail-arrow">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
