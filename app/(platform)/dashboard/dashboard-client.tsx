"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { resolveGigOverviewIndicator } from "@/data/scm-data";
import { getGigDate, resolveGigRegisterSection } from "@/lib/gig-archive";
import type { Gig } from "@/types/scm";

const timeframeFilters = [
  { label: "ALL", value: "all" },
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Set date / interval", value: "custom" },
] as const;

const dateMonthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const markerFilters = [
  { label: "All", value: "all" },
  { label: "Identified", value: "identified" },
  { label: "In Progress", value: "inProgress" },
  { label: "Confirmed", value: "confirmed" },
  { label: "No merch", value: "noMerch" },
] as const;

const calendarWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const countryOptions = ["Sweden", "Norway", "Denmark", "Finland"] as const;

type DashboardRangeFilter = (typeof timeframeFilters)[number]["value"];
type DashboardMarkerFilter = (typeof markerFilters)[number]["value"];
type DashboardGigView = "all" | "toBeClosed";
type DashboardFilters = {
  country: string;
  city: string;
  scmRep: string;
  arena: string;
  artist: string;
  view: DashboardGigView;
  range: DashboardRangeFilter;
  marker: DashboardMarkerFilter;
  month: string;
  fromDate: string;
  toDate: string;
};

function readParam(value: string | null) {
  return value ?? undefined;
}

function resolveRangeFilter(value: string | undefined): DashboardRangeFilter {
  return timeframeFilters.some((filter) => filter.value === value)
    ? (value as DashboardRangeFilter)
    : "all";
}

function resolveMarkerFilter(value: string | undefined): DashboardMarkerFilter {
  return markerFilters.some((filter) => filter.value === value)
    ? (value as DashboardMarkerFilter)
    : "all";
}

function resolveGigView(value: string | undefined): DashboardGigView {
  return value === "toBeClosed" ? "toBeClosed" : "all";
}

function getCurrentMonthValue() {
  return String(new Date().getMonth() + 1).padStart(2, "0");
}

function resolveMonthFilter(value: string | undefined) {
  const candidate = value ?? "";
  return dateMonthOptions.some((option) => option.value === candidate)
    ? candidate
    : getCurrentMonthValue();
}

function resolveValueFilter(value: string | undefined, options: readonly string[]) {
  return value && options.includes(value) ? value : "all";
}

function getUniqueGigValues(gigs: Gig[], getValue: (gig: Gig) => string) {
  return [...new Set(gigs.map((gig) => getValue(gig).trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

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

function matchesMarkerFilter(gig: Gig, filter: DashboardMarkerFilter) {
  if (filter === "all") {
    return true;
  }

  return resolveGigOverviewIndicator(gig) === filter;
}

function matchesDateFilter(
  dateValue: string,
  range: DashboardRangeFilter,
  monthValue: string,
  fromDate: string,
  toDate: string,
) {
  const today = normalizeDate(new Date());
  const gigDate = getGigDate(dateValue);
  const diffInDays = Math.floor(
    (gigDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (range === "today") {
    return diffInDays === 0;
  }

  if (range === "week") {
    return diffInDays >= 0 && diffInDays <= 7;
  }

  if (range === "month") {
    return dateValue.slice(5, 7) === monthValue && diffInDays >= 0;
  }

  if (range === "custom") {
    const lowerBound = fromDate ? getGigDate(fromDate) : null;
    const upperBound = toDate ? getGigDate(toDate) : null;

    if (lowerBound && gigDate < lowerBound) {
      return false;
    }

    if (upperBound && gigDate > upperBound) {
      return false;
    }

    return true;
  }

  return diffInDays >= 0;
}

function getInitialCalendarMonth(sourceGigs: Gig[]) {
  const sortedGigs = [...sourceGigs].sort((left, right) => left.date.localeCompare(right.date));

  if (sortedGigs.length === 0) {
    return normalizeDate(new Date());
  }

  const today = normalizeDate(new Date());
  const nextUpcomingGig =
    sortedGigs.find((gig) => getGigDate(gig.date).getTime() >= today.getTime()) ??
    sortedGigs[sortedGigs.length - 1];
  const targetDate = getGigDate(nextUpcomingGig.date);
  return new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getIsoWeekNumber(date: Date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function buildCalendarRows(viewMonth: Date, visibleGigs: Gig[]) {
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  gridStart.setDate(monthStart.getDate() - mondayOffset);

  const gigMap = new Map<string, Gig[]>();
  visibleGigs.forEach((gig) => {
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
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDisplayDate(date: string) {
  return date;
}

function formatToBeClosedCount(count: number) {
  return count === 1 ? "1 gig" : `${count} gigs`;
}

function SummaryGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6h12v12H6V6Zm2 2v8h8V8H8Zm2-5h4v2h-4V3Zm0 16h4v2h-4v-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="summary-card compact">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      <span className="summary-icon blue">
        <SummaryGlyph />
      </span>
    </div>
  );
}

function getOverviewIndicatorClass(gig: Gig) {
  return resolveGigOverviewIndicator(gig);
}

function ToBeClosedCountryCard({
  country,
  count,
  active,
  onClick,
}: {
  country: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`overview-country-card compact ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <small>{country.toUpperCase()}</small>
      <div className="overview-country-card-title-row">
        <strong>To be closed</strong>
        <span>{formatToBeClosedCount(count)}</span>
      </div>
    </button>
  );
}

function DashboardGigRow({ gig }: { gig: Gig }) {
  return (
    <Link
      href={`/gigs/${gig.id}`}
      className="overview-gig-row compact"
      data-text-edit-exclude="true"
    >
      <div className="overview-gig-thumb" aria-hidden="true">
        {gig.profileImageUrl ? (
          <Image
            src={gig.profileImageUrl}
            alt=""
            fill
            sizes="56px"
            className="overview-gig-thumb-image"
          />
        ) : (
          gig.artist.charAt(0)
        )}
      </div>

      <div className="overview-gig-body">
        <div className="overview-gig-head compact">
          <div className="overview-gig-copy">
            <h3>{gig.artist}</h3>
            <p className="overview-gig-date">{formatDisplayDate(gig.date)}</p>
            <p className="overview-gig-venue">
              {gig.arena}, {gig.city}, {gig.country}
            </p>
          </div>

          <span
            className={`overview-gig-status-dot ${getOverviewIndicatorClass(gig)}`}
            aria-label={`${resolveGigOverviewIndicator(gig)} status marker`}
          />

          <div className="overview-gig-meta">
            <span>{gig.scmRepresentative}</span>
            <small>{gig.merchCompany}</small>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function DashboardClient({
  gigs,
}: {
  gigs: Gig[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [monthOffset, setMonthOffset] = useState(0);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const cityOptions = getUniqueGigValues(gigs, (gig) => gig.city);
  const scmRepOptions = getUniqueGigValues(gigs, (gig) => gig.scmRepresentative);
  const arenaOptions = getUniqueGigValues(gigs, (gig) => gig.arena);
  const artistOptions = getUniqueGigValues(gigs, (gig) => gig.artist);

  const activeCountry = resolveValueFilter(readParam(searchParams.get("country")), countryOptions);
  const activeCity = resolveValueFilter(readParam(searchParams.get("city")), cityOptions);
  const activeScmRep = resolveValueFilter(readParam(searchParams.get("scmRep")), scmRepOptions);
  const activeArena = resolveValueFilter(readParam(searchParams.get("arena")), arenaOptions);
  const activeArtist = resolveValueFilter(readParam(searchParams.get("artist")), artistOptions);
  const activeGigView = resolveGigView(readParam(searchParams.get("view")));
  const activeRange = resolveRangeFilter(readParam(searchParams.get("range")));
  const activeMonth = resolveMonthFilter(readParam(searchParams.get("month")));
  const activeMarker = resolveMarkerFilter(readParam(searchParams.get("marker")));
  const activeFromDate = readParam(searchParams.get("from")) ?? "";
  const activeToDate = readParam(searchParams.get("to")) ?? "";
  const currentFilters: DashboardFilters = {
    country: activeCountry,
    city: activeCity,
    scmRep: activeScmRep,
    arena: activeArena,
    artist: activeArtist,
    view: activeGigView,
    range: activeRange,
    marker: activeMarker,
    month: activeMonth,
    fromDate: activeFromDate,
    toDate: activeToDate,
  };

  const hasAnyActiveFilters =
    activeGigView !== "all" ||
    activeCountry !== "all" ||
    activeCity !== "all" ||
    activeScmRep !== "all" ||
    activeArena !== "all" ||
    activeArtist !== "all" ||
    activeRange !== "all" ||
    activeMarker !== "all" ||
    activeFromDate !== "" ||
    activeToDate !== "";
  const toBeClosedCountryCards = countryOptions.map((country) => ({
    country,
    count: gigs.filter(
      (gig) =>
        gig.country === country && resolveGigRegisterSection(gig) === "toBeClosed",
    ).length,
  }));

  const filteredGigs = gigs.filter((gig) => {
    const gigSection = resolveGigRegisterSection(gig);

    if (gigSection === "closed") {
      return false;
    }

    if (activeGigView === "toBeClosed" && gigSection !== "toBeClosed") {
      return false;
    }

    if (activeCountry !== "all" && gig.country !== activeCountry) {
      return false;
    }

    if (activeCity !== "all" && gig.city !== activeCity) {
      return false;
    }

    if (activeScmRep !== "all" && gig.scmRepresentative !== activeScmRep) {
      return false;
    }

    if (activeArena !== "all" && gig.arena !== activeArena) {
      return false;
    }

    if (activeArtist !== "all" && gig.artist !== activeArtist) {
      return false;
    }

    if (!matchesMarkerFilter(gig, activeMarker)) {
      return false;
    }

    if (activeGigView === "toBeClosed" && activeRange === "all") {
      return true;
    }

    if (activeGigView === "toBeClosed" && activeRange === "month") {
      return gig.date.slice(5, 7) === activeMonth;
    }

    return matchesDateFilter(
      gig.date,
      activeRange,
      activeMonth,
      activeFromDate,
      activeToDate,
    );
  });

  const baseCalendarMonth =
    activeRange === "month"
      ? new Date(getInitialCalendarMonth(filteredGigs.length > 0 ? filteredGigs : gigs).getFullYear(), Number(activeMonth) - 1, 1)
      : getInitialCalendarMonth(filteredGigs.length > 0 ? filteredGigs : gigs);
  const calendarMonth = addMonths(baseCalendarMonth, monthOffset);
  const calendarRows = buildCalendarRows(calendarMonth, filteredGigs);
  const openGigs = gigs.filter(
    (gig) => resolveGigRegisterSection(gig) !== "closed",
  ).length;

  function pushFilterRoute(nextFilters: DashboardFilters) {
    const params = new URLSearchParams(searchParams.toString());

    [
      ["country", nextFilters.country],
      ["city", nextFilters.city],
      ["scmRep", nextFilters.scmRep],
      ["arena", nextFilters.arena],
      ["artist", nextFilters.artist],
    ].forEach(([key, value]) => {
      if (value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    if (nextFilters.view !== "all") {
      params.set("view", nextFilters.view);
    } else {
      params.delete("view");
    }

    if (nextFilters.range !== "all") {
      params.set("range", nextFilters.range);
    } else {
      params.delete("range");
    }

    if (nextFilters.marker !== "all") {
      params.set("marker", nextFilters.marker);
    } else {
      params.delete("marker");
    }

    if (nextFilters.range === "month") {
      params.set("month", nextFilters.month);
      params.delete("from");
      params.delete("to");
    } else if (nextFilters.range === "custom") {
      if (nextFilters.fromDate) {
        params.set("from", nextFilters.fromDate);
      } else {
        params.delete("from");
      }

      if (nextFilters.toDate) {
        params.set("to", nextFilters.toDate);
      } else {
        params.delete("to");
      }

      params.delete("month");
    } else {
      params.delete("month");
      params.delete("from");
      params.delete("to");
    }

    startTransition(() => {
      const nextQuery = params.toString();
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    });
  }

  function updateCountryFilter(country: string) {
    setMonthOffset(0);
    pushFilterRoute({ ...currentFilters, country });
  }

  function updateCityFilter(city: string) {
    setMonthOffset(0);
    pushFilterRoute({ ...currentFilters, city });
  }

  function updateScmRepFilter(scmRep: string) {
    setMonthOffset(0);
    pushFilterRoute({ ...currentFilters, scmRep });
  }

  function updateArenaFilter(arena: string) {
    setMonthOffset(0);
    pushFilterRoute({ ...currentFilters, arena });
  }

  function updateArtistFilter(artist: string) {
    setMonthOffset(0);
    pushFilterRoute({ ...currentFilters, artist });
  }

  function updateRangeFilter(range: DashboardRangeFilter) {
    setMonthOffset(0);
    pushFilterRoute({
      ...currentFilters,
      range,
      month: range === "month" ? activeMonth : getCurrentMonthValue(),
      fromDate: range === "custom" ? activeFromDate : "",
      toDate: range === "custom" ? activeToDate : "",
    });
  }

  function updateMonthFilter(month: string) {
    setMonthOffset(0);
    pushFilterRoute({ ...currentFilters, range: "month", month });
  }

  function updateMarkerFilter(marker: DashboardMarkerFilter) {
    setMonthOffset(0);
    pushFilterRoute({ ...currentFilters, marker });
  }

  function updateCustomDates(nextFromDate: string, nextToDate: string) {
    setMonthOffset(0);
    pushFilterRoute({
      ...currentFilters,
      range: "custom",
      fromDate: nextFromDate,
      toDate: nextToDate,
    });
  }

  function clearAllFilters() {
    setMonthOffset(0);
    setIsFilterPanelOpen(false);
    pushFilterRoute({
      country: "all",
      city: "all",
      scmRep: "all",
      arena: "all",
      artist: "all",
      view: "all",
      range: "all",
      marker: "all",
      month: getCurrentMonthValue(),
      fromDate: "",
      toDate: "",
    });
  }

  function toggleToBeClosedCountry(country: string) {
    const isActiveCountry = activeGigView === "toBeClosed" && activeCountry === country;

    setMonthOffset(0);
    pushFilterRoute({
      ...currentFilters,
      view: isActiveCountry ? "all" : "toBeClosed",
      country: isActiveCountry ? "all" : country,
    });
  }

  return (
    <div className="dashboard-overview compact" aria-busy={isPending}>
      <section className="overview-toolbar compact">
        <div className="overview-filter-stack">
          <div className="overview-filter-action-row">
            <button
              type="button"
              className={`segment-chip overview-filter-group-button ${
                isFilterPanelOpen || hasAnyActiveFilters ? "active" : ""
              }`}
              onClick={() => setIsFilterPanelOpen((current) => !current)}
            >
              Filter
            </button>

            <button
              type="button"
              className={`segment-chip overview-filter-group-button ${
                hasAnyActiveFilters ? "active" : ""
              }`}
              onClick={clearAllFilters}
            >
              Clear Filters
            </button>
          </div>

          {isFilterPanelOpen ? (
            <div className="overview-filter-panel">
              <div className="overview-filter-select-grid">
                <label className="overview-filter-field">
                  <span>Country</span>
                  <select
                    value={activeCountry}
                    onChange={(event) => updateCountryFilter(event.currentTarget.value)}
                  >
                    <option value="all">All</option>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="overview-filter-field">
                  <span>Date</span>
                  <select
                    value={activeRange}
                    onChange={(event) =>
                      updateRangeFilter(event.currentTarget.value as DashboardRangeFilter)
                    }
                  >
                    {timeframeFilters.map((filter) => (
                      <option key={filter.value} value={filter.value}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="overview-filter-field">
                  <span>Progress</span>
                  <select
                    value={activeMarker}
                    onChange={(event) =>
                      updateMarkerFilter(event.currentTarget.value as DashboardMarkerFilter)
                    }
                  >
                    {markerFilters.map((filter) => (
                      <option key={filter.value} value={filter.value}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="overview-filter-field">
                  <span>SCM REP</span>
                  <select
                    value={activeScmRep}
                    onChange={(event) => updateScmRepFilter(event.currentTarget.value)}
                  >
                    <option value="all">All</option>
                    {scmRepOptions.map((scmRep) => (
                      <option key={scmRep} value={scmRep}>
                        {scmRep}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="overview-filter-field">
                  <span>Arena</span>
                  <select
                    value={activeArena}
                    onChange={(event) => updateArenaFilter(event.currentTarget.value)}
                  >
                    <option value="all">All</option>
                    {arenaOptions.map((arena) => (
                      <option key={arena} value={arena}>
                        {arena}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="overview-filter-field">
                  <span>Artist</span>
                  <select
                    value={activeArtist}
                    onChange={(event) => updateArtistFilter(event.currentTarget.value)}
                  >
                    <option value="all">All</option>
                    {artistOptions.map((artist) => (
                      <option key={artist} value={artist}>
                        {artist}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="overview-filter-field">
                  <span>City</span>
                  <select
                    value={activeCity}
                    onChange={(event) => updateCityFilter(event.currentTarget.value)}
                  >
                    <option value="all">All</option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {activeRange === "month" ? (
                <div className="overview-filter-date-row">
                  <label className="overview-filter-field overview-filter-field-narrow">
                    <span>Month</span>
                    <select
                      value={activeMonth}
                      onChange={(event) => updateMonthFilter(event.currentTarget.value)}
                    >
                      {dateMonthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {activeRange === "custom" ? (
                <div className="overview-filter-date-row">
                  <label className="overview-filter-field overview-filter-field-narrow">
                    <span>From</span>
                    <input
                      type="date"
                      value={activeFromDate}
                      onChange={(event) => updateCustomDates(event.currentTarget.value, activeToDate)}
                    />
                  </label>

                  <label className="overview-filter-field overview-filter-field-narrow">
                    <span>To</span>
                    <input
                      type="date"
                      value={activeToDate}
                      onChange={(event) => updateCustomDates(activeFromDate, event.currentTarget.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="overview-actions compact">
          <SummaryCard label="Open gigs" value={openGigs} />
          <SummaryCard label="Shown" value={filteredGigs.length} />
        </div>
      </section>

      <section className="overview-content-grid compact">
        <div className="overview-gigs-panel compact">
          <div className="overview-country-card-grid compact">
            {toBeClosedCountryCards.map((entry) => (
              <ToBeClosedCountryCard
                key={entry.country}
                country={entry.country}
                count={entry.count}
                active={activeGigView === "toBeClosed" && activeCountry === entry.country}
                onClick={() => toggleToBeClosedCountry(entry.country)}
              />
            ))}
          </div>

          <div className="overview-gig-list compact">
            {filteredGigs.length === 0 ? (
              <div className="overview-empty-state">
                {activeGigView === "toBeClosed"
                  ? "No to-be-closed gigs match the current filters."
                  : "No gigs match the current filters."}
              </div>
            ) : (
              filteredGigs.map((gig) => <DashboardGigRow key={gig.id} gig={gig} />)
            )}
          </div>
        </div>

        <aside className="overview-side-panel compact">
          <section className="overview-card calendar-card compact">
            <div className="calendar-head">
              <h2>{formatMonthLabel(calendarMonth)}</h2>
              <div className="calendar-nav">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonthOffset((current) => current - 1)}
                >
                  &lt;
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonthOffset((current) => current + 1)}
                >
                  &gt;
                </button>
              </div>
            </div>

            <div className="calendar-grid calendar-grid-head">
              <span />
              {calendarWeekdays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="calendar-body compact">
              {calendarRows.map((row) => (
                <div key={row.week} className="calendar-grid calendar-grid-row">
                  <span className="calendar-week">{row.week}</span>
                  {row.days.map((day) => (
                    <div
                      key={day.key}
                      className={`calendar-day-cell ${
                        day.inMonth ? "" : "outside-month"
                      } ${day.gigs.length > 0 ? "has-gigs" : ""}`}
                    >
                      <span className="calendar-day-number">{day.label}</span>
                      <div className="calendar-day-gigs">
                        {day.gigs.slice(0, 2).map((gig) => (
                          <Link
                            key={gig.id}
                            href={`/gigs/${gig.id}`}
                            className="calendar-gig-button"
                          >
                            {gig.artist}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
