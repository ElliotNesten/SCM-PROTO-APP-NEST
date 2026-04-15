"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { resolveGigOverviewIndicator } from "@/data/scm-data";
import {
  getGigDate,
  isGigArchivedOnlyForRegister,
  resolveGigRegisterSection,
} from "@/lib/gig-archive";
import type { Gig } from "@/types/scm";

const timeframeFilters = [
  { label: "ALL", value: "all" },
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Custom dates", value: "custom" },
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

function matchesMarkerFilter(gig: Gig, filter: DashboardMarkerFilter) {
  if (filter === "all") return true;
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

  if (range === "today") return diffInDays === 0;
  if (range === "week") return diffInDays >= 0 && diffInDays <= 7;
  if (range === "month") return dateValue.slice(5, 7) === monthValue && diffInDays >= 0;
  if (range === "custom") {
    const lowerBound = fromDate ? getGigDate(fromDate) : null;
    const upperBound = toDate ? getGigDate(toDate) : null;
    if (lowerBound && gigDate < lowerBound) return false;
    if (upperBound && gigDate > upperBound) return false;
    return true;
  }
  return diffInDays >= 0;
}

function formatFriendlyDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = normalizeDate(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const gigDate = normalizeDate(date);

  if (gigDate.getTime() === today.getTime()) return "Today";
  if (gigDate.getTime() === tomorrow.getTime()) return "Tomorrow";

  const diffDays = Math.floor((gigDate.getTime() - today.getTime()) / 86400000);
  if (diffDays > 0 && diffDays <= 6) {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
  }

  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function formatRevenue(amount: number) {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    // Show one decimal if not a round number
    const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1);
    return `${formatted}M SEK`;
  }
  return `${Math.round(amount / 1000).toLocaleString()}k SEK`;
}

function getOverviewIndicatorClass(gig: Gig) {
  return resolveGigOverviewIndicator(gig);
}

function DashboardGigRow({ gig }: { gig: Gig }) {
  const friendlyDate = formatFriendlyDate(gig.date);
  return (
    <Link
      href={`/gigs/${gig.id}`}
      className="overview-gig-row compact"
      data-text-edit-exclude="true"
    >
      <div className="overview-gig-head compact">
        <div className="overview-gig-copy">
          <h3>{gig.artist}</h3>
          <p className="overview-gig-venue">
            {friendlyDate} · {gig.arena}, {gig.city}
          </p>
        </div>

        <span
          className={`overview-gig-status-dot ${getOverviewIndicatorClass(gig)}`}
          aria-label={`${resolveGigOverviewIndicator(gig)} status marker`}
        />
      </div>
    </Link>
  );
}

export function DashboardClient({
  gigs,
  firstName,
}: {
  gigs: Gig[];
  firstName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const isFilterPanelOpen = searchParams.get("fp") === "1";

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredGigs = gigs.filter((gig) => {
    const gigSection = resolveGigRegisterSection(gig);
    if (gigSection === "closed" || isGigArchivedOnlyForRegister(gig)) return false;
    if (activeGigView === "toBeClosed" && gigSection !== "toBeClosed") return false;
    if (activeCountry !== "all" && gig.country !== activeCountry) return false;
    if (activeCity !== "all" && gig.city !== activeCity) return false;
    if (activeScmRep !== "all" && gig.scmRepresentative !== activeScmRep) return false;
    if (activeArena !== "all" && gig.arena !== activeArena) return false;
    if (activeArtist !== "all" && gig.artist !== activeArtist) return false;
    if (!matchesMarkerFilter(gig, activeMarker)) return false;
    if (activeGigView === "toBeClosed" && activeRange === "all") return true;
    if (activeGigView === "toBeClosed" && activeRange === "month") {
      return gig.date.slice(5, 7) === activeMonth;
    }
    return matchesDateFilter(gig.date, activeRange, activeMonth, activeFromDate, activeToDate);
  });

  const openGigs = gigs.filter(
    (gig) => resolveGigRegisterSection(gig) !== "closed" && !isGigArchivedOnlyForRegister(gig),
  ).length;

  // Stats — computed from all gigs, not filtered
  const upcomingGigs = gigs.filter((gig) => {
    const [y, m, d] = gig.date.split("-").map(Number);
    return new Date(y, m - 1, d) >= today && resolveGigRegisterSection(gig) !== "closed";
  });
  const pastGigs = gigs.filter((gig) => {
    const [y, m, d] = gig.date.split("-").map(Number);
    return new Date(y, m - 1, d) < today;
  });
  const totalRevenue = upcomingGigs.reduce(
    (sum, gig) => sum + (gig.salesEstimateOverride ?? gig.ticketsSold * gig.estimatedSpendPerVisitor), 0,
  );
  const totalTickets = upcomingGigs.reduce((sum, gig) => sum + gig.ticketsSold, 0);

  // Next gig
  const nextGig = [...upcomingGigs].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const nextGigDaysAway = nextGig
    ? Math.floor((getGigDate(nextGig.date).getTime() - today.getTime()) / 86400000)
    : null;

  function pushFilterRoute(nextFilters: DashboardFilters) {
    const params = new URLSearchParams(searchParams.toString());
    if (!isFilterPanelOpen) params.delete("fp");

    [
      ["country", nextFilters.country],
      ["city", nextFilters.city],
      ["scmRep", nextFilters.scmRep],
      ["arena", nextFilters.arena],
      ["artist", nextFilters.artist],
    ].forEach(([key, value]) => {
      if (value !== "all") params.set(key, value);
      else params.delete(key);
    });

    if (nextFilters.view !== "all") params.set("view", nextFilters.view);
    else params.delete("view");
    if (nextFilters.range !== "all") params.set("range", nextFilters.range);
    else params.delete("range");
    if (nextFilters.marker !== "all") params.set("marker", nextFilters.marker);
    else params.delete("marker");

    if (nextFilters.range === "month") {
      params.set("month", nextFilters.month);
      params.delete("from");
      params.delete("to");
    } else if (nextFilters.range === "custom") {
      if (nextFilters.fromDate) params.set("from", nextFilters.fromDate);
      else params.delete("from");
      if (nextFilters.toDate) params.set("to", nextFilters.toDate);
      else params.delete("to");
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

  function updateCountryFilter(country: string) { pushFilterRoute({ ...currentFilters, country }); }
  function updateCityFilter(city: string) { pushFilterRoute({ ...currentFilters, city }); }
  function updateScmRepFilter(scmRep: string) { pushFilterRoute({ ...currentFilters, scmRep }); }
  function updateArenaFilter(arena: string) { pushFilterRoute({ ...currentFilters, arena }); }
  function updateArtistFilter(artist: string) { pushFilterRoute({ ...currentFilters, artist }); }
  function updateRangeFilter(range: DashboardRangeFilter) {
    pushFilterRoute({
      ...currentFilters,
      range,
      month: range === "month" ? activeMonth : getCurrentMonthValue(),
      fromDate: range === "custom" ? activeFromDate : "",
      toDate: range === "custom" ? activeToDate : "",
    });
  }
  function updateMonthFilter(month: string) { pushFilterRoute({ ...currentFilters, range: "month", month }); }
  function updateMarkerFilter(marker: DashboardMarkerFilter) { pushFilterRoute({ ...currentFilters, marker }); }
  function updateCustomDates(nextFromDate: string, nextToDate: string) {
    pushFilterRoute({ ...currentFilters, range: "custom", fromDate: nextFromDate, toDate: nextToDate });
  }
  function clearAllFilters() {
    const params = new URLSearchParams();
    params.set("fp", "1");
    startTransition(() => { router.push(`${pathname}?${params.toString()}`); });
  }

  return (
    <div className="dashboard-overview compact" aria-busy={isPending}>
      {isFilterPanelOpen ? (
        <div className="dashboard-filter-dropdown">
          <div className="dashboard-filter-grid">
            <label className="overview-filter-field">
              <span>Country</span>
              <select value={activeCountry} onChange={(e) => updateCountryFilter(e.currentTarget.value)}>
                <option value="all">All countries</option>
                {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="overview-filter-field">
              <span>Date range</span>
              <select value={activeRange} onChange={(e) => updateRangeFilter(e.currentTarget.value as DashboardRangeFilter)}>
                {timeframeFilters.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label className="overview-filter-field">
              <span>Progress</span>
              <select value={activeMarker} onChange={(e) => updateMarkerFilter(e.currentTarget.value as DashboardMarkerFilter)}>
                {markerFilters.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label className="overview-filter-field">
              <span>SCM Onsite Rep</span>
              <select value={activeScmRep} onChange={(e) => updateScmRepFilter(e.currentTarget.value)}>
                <option value="all">All reps</option>
                {scmRepOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="overview-filter-field">
              <span>Arena</span>
              <select value={activeArena} onChange={(e) => updateArenaFilter(e.currentTarget.value)}>
                <option value="all">All arenas</option>
                {arenaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="overview-filter-field">
              <span>Artist</span>
              <select value={activeArtist} onChange={(e) => updateArtistFilter(e.currentTarget.value)}>
                <option value="all">All artists</option>
                {artistOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="overview-filter-field">
              <span>City</span>
              <select value={activeCity} onChange={(e) => updateCityFilter(e.currentTarget.value)}>
                <option value="all">All cities</option>
                {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {activeRange === "month" && (
              <label className="overview-filter-field">
                <span>Month</span>
                <select value={activeMonth} onChange={(e) => updateMonthFilter(e.currentTarget.value)}>
                  {dateMonthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
            )}
            {activeRange === "custom" && (
              <>
                <label className="overview-filter-field">
                  <span>From</span>
                  <input type="date" value={activeFromDate} onChange={(e) => updateCustomDates(e.currentTarget.value, activeToDate)} />
                </label>
                <label className="overview-filter-field">
                  <span>To</span>
                  <input type="date" value={activeToDate} onChange={(e) => updateCustomDates(activeFromDate, e.currentTarget.value)} />
                </label>
              </>
            )}
          </div>
          <div className="dashboard-filter-footer">
            <div className="dashboard-filter-stats">
              <span>{openGigs} open · {filteredGigs.length} shown</span>
            </div>
            {hasAnyActiveFilters && (
              <button type="button" className="dashboard-filter-clear" onClick={clearAllFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Greeting with inline stats ─────────────────────────── */}
      <div className="dashboard-greeting-block">
        <h2 className="dashboard-greeting">Hi, {firstName || "there"}</h2>
        <p className="dashboard-greeting-summary">
          You have <strong>{upcomingGigs.length} upcoming gig{upcomingGigs.length !== 1 ? "s" : ""}</strong> with a total of{" "}
          <strong>{totalTickets.toLocaleString()} tickets</strong> sold and an estimated revenue of{" "}
          <strong>{formatRevenue(totalRevenue)}</strong>.
          {pastGigs.length > 0 && (
            <> You also have <strong>{pastGigs.length} completed gig{pastGigs.length !== 1 ? "s" : ""}</strong>.</>
          )}
        </p>
      </div>

      {/* ── Next gig highlight ─────────────────────────── */}
      {nextGig && (
        <Link href={`/gigs/${nextGig.id}`} className="next-gig-card">
          <div className="next-gig-label">
            Next gig · {nextGigDaysAway === 0 ? "Today" : nextGigDaysAway === 1 ? "Tomorrow" : `in ${nextGigDaysAway} days`}
          </div>
          <div className="next-gig-artist">{nextGig.artist}</div>
          <div className="next-gig-details">
            {formatFriendlyDate(nextGig.date)} · {nextGig.arena}, {nextGig.city}
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="next-gig-arrow">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      )}

      {/* ── Gig list ─────────────────────────── */}
      <div className="all-gigs-section">
        <div className="all-gigs-section-head">
          <span className="all-gigs-title">Gigs</span>
          <span className="all-gigs-count">{filteredGigs.length} gigs</span>
        </div>

        <div className="quick-filter-row">
          {countryOptions.map((country) => {
            const count = filteredGigs.filter((g) => g.country === country).length;
            return (
              <button
                type="button"
                key={country}
                className={`qf-chip ${activeCountry === country ? "active" : ""}`}
                onClick={() => updateCountryFilter(activeCountry === country ? "all" : country)}
              >
                {country}
                {count > 0 ? <span className="qf-chip-count"> · {count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="overview-gig-list compact">
          {filteredGigs.length === 0 ? (
            <div className="overview-empty-state">No gigs found.</div>
          ) : (
            filteredGigs.map((gig) => <DashboardGigRow key={gig.id} gig={gig} />)
          )}
        </div>
      </div>
    </div>
  );
}
