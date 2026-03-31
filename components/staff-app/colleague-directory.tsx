"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import type { StaffAppColleague } from "@/types/staff-app";

function StaffAppColleagueChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function getColleagueInitials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function StaffAppColleagueDirectory({
  colleagues,
}: {
  colleagues: StaffAppColleague[];
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredColleagues = colleagues.filter((colleague) => {
    if (!normalizedQuery) {
      return true;
    }

    return [colleague.fullName, colleague.role, colleague.region, colleague.email]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <div className="staff-app-colleague-directory">
      <label className="staff-app-colleague-search">
        <span className="staff-app-colleague-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle
              cx="11"
              cy="11"
              r="5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="m16 16 3.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search colleagues..."
          aria-label="Search colleagues"
        />
      </label>

      {filteredColleagues.length === 0 ? (
        <div className="staff-app-empty-state">
          No matching colleagues were found in your local region.
        </div>
      ) : (
        <div className="staff-app-colleague-list">
          {filteredColleagues.map((colleague) => {
            const initials = getColleagueInitials(colleague.fullName);

            return (
              <Link
                key={colleague.id}
                href={`/staff-app/colleagues/${colleague.id}`}
                className="staff-app-colleague-row"
              >
                <span className="staff-app-colleague-row-main">
                  <span className="staff-app-colleague-avatar" aria-hidden="true">
                    {colleague.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={colleague.profileImageUrl} alt={colleague.fullName} />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </span>
                  <span className="staff-app-colleague-row-copy">
                    <strong>{colleague.fullName}</strong>
                    <span>{colleague.country}, {colleague.region}</span>
                  </span>
                </span>
                <span className="staff-app-colleague-chevron" aria-hidden="true">
                  <StaffAppColleagueChevron />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
