"use client";

import { useState } from "react";

type StaffAppArenaItem = {
  id: string;
  country: string;
  arena: string;
  city: string;
  region: string;
  gigCount: number;
  latestDate: string;
  notes: string;
};

function formatArenaDate(value: string) {
  const parsedDate = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  }).format(parsedDate);
}

export function StaffAppArenaDirectory({
  arenas,
  defaultCountry,
  emptyStateMessage,
}: {
  arenas: StaffAppArenaItem[];
  defaultCountry?: string;
  emptyStateMessage?: string;
}) {
  const countries = Array.from(new Set(arenas.map((arena) => arena.country))).sort((left, right) =>
    left.localeCompare(right),
  );
  const initialCountry =
    defaultCountry && countries.includes(defaultCountry) ? defaultCountry : countries[0] ?? "";
  const [activeCountry, setActiveCountry] = useState(initialCountry);

  const visibleArenas = activeCountry
    ? arenas.filter((arena) => arena.country === activeCountry)
    : arenas;

  return (
    <div className="staff-app-arena-directory">
      <div className="staff-app-arena-filter-row">
        {countries.map((country) => (
          <button
            key={country}
            type="button"
            className={`staff-app-arena-filter${activeCountry === country ? " active" : ""}`}
            onClick={() => setActiveCountry(country)}
          >
            {country}
          </button>
        ))}
      </div>

      {visibleArenas.length === 0 ? (
        <div className="staff-app-empty-state">
          {emptyStateMessage || "No arenas are currently listed for this country."}
        </div>
      ) : (
        <div className="staff-app-arena-list">
          {visibleArenas.map((arena) => (
            <article key={arena.id} className="staff-app-arena-card">
              <div className="staff-app-arena-card-head">
                <div>
                  <p className="staff-app-kicker">{arena.country}</p>
                  <h2>{arena.arena}</h2>
                </div>
                <span className="staff-app-badge neutral">{arena.gigCount} gigs</span>
              </div>

              <div className="staff-app-arena-meta">
                <span>{arena.city}</span>
                <span>Region: {arena.region}</span>
                <span>Latest activity: {formatArenaDate(arena.latestDate)}</span>
              </div>

              <p className="staff-app-muted">{arena.notes}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
