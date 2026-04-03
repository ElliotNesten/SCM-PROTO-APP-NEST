"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function OverviewIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v11h14V10" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function GigsIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function CalendarIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TeamIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2h16ZM9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ProfileIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7H4Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function BottomNav({
  canAccessScmStaff,
}: {
  canAccessScmStaff: boolean;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  }

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <Link href="/dashboard" className={`bottom-nav-tab ${isActive("/dashboard") ? "active" : ""}`}>
        <span className="bottom-nav-icon">
          <OverviewIcon filled={isActive("/dashboard")} />
        </span>
        <span className="bottom-nav-label">Overview</span>
      </Link>

      <Link href="/gigs" className={`bottom-nav-tab ${isActive("/gigs") ? "active" : ""}`}>
        <span className="bottom-nav-icon">
          <GigsIcon filled={isActive("/gigs")} />
        </span>
        <span className="bottom-nav-label">Gigs</span>
      </Link>

      <Link href="/calendar" className={`bottom-nav-tab ${isActive("/calendar") ? "active" : ""}`}>
        <span className="bottom-nav-icon">
          <CalendarIcon filled={isActive("/calendar")} />
        </span>
        <span className="bottom-nav-label">Calendar</span>
      </Link>

      {canAccessScmStaff && (
        <Link href="/scm-staff" className={`bottom-nav-tab ${isActive("/scm-staff") ? "active" : ""}`}>
          <span className="bottom-nav-icon">
            <TeamIcon filled={isActive("/scm-staff")} />
          </span>
          <span className="bottom-nav-label">SCM Staff</span>
        </Link>
      )}

      <Link href="/profile" className={`bottom-nav-tab ${isActive("/profile") ? "active" : ""}`}>
        <span className="bottom-nav-icon">
          <ProfileIcon filled={isActive("/profile")} />
        </span>
        <span className="bottom-nav-label">Profile</span>
      </Link>
    </nav>
  );
}
