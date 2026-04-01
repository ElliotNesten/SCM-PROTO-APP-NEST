"use client";

import { useState } from "react";

import { StaffAppGuidePdfLink } from "@/components/staff-app/guide-pdf-link";

type StaffAppArenaItem = {
  id: string;
  country: string;
  arena: string;
  city: string;
  documents: Array<{
    id: string;
    label: string;
    href: string;
  }>;
};

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
              <div className="staff-app-arena-card-head compact">
                <p className="staff-app-kicker">{arena.country}</p>
                <h2>{arena.arena}</h2>
              </div>

              <div className="staff-app-arena-meta compact">
                <span>{arena.city}</span>
              </div>

              <div className="staff-app-arena-actions">
                {arena.documents.map((document) =>
                  document.href ? (
                    <StaffAppGuidePdfLink
                      key={document.id}
                      href={document.href}
                      label={document.label}
                      className="staff-app-arena-document-button"
                    />
                  ) : (
                    <button
                      key={document.id}
                      type="button"
                      disabled
                      className="staff-app-button secondary staff-app-guide-pdf-link disabled staff-app-arena-document-button"
                    >
                      {document.label}
                    </button>
                  ),
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
