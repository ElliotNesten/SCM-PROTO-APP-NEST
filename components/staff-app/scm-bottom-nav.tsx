"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ScmNavIconKind = "overview" | "gigs" | "team" | "profile";

function ScmBottomNavIcon({ kind }: { kind: ScmNavIconKind }) {
  switch (kind) {
    case "overview":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 18V6m7 12v-8m7 8v-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "gigs":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 7.5h10A2.5 2.5 0 0 1 19.5 10a2.5 2.5 0 0 0 0 4A2.5 2.5 0 0 1 17 16.5H7A2.5 2.5 0 0 1 4.5 14a2.5 2.5 0 0 0 0-4A2.5 2.5 0 0 1 7 7.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M12 8.5v7"
            fill="none"
            stroke="currentColor"
            strokeDasharray="1.5 2"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "team":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8.5" cy="9.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15.5" cy="8.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5 18a4 4 0 0 1 7 0m2-1a3.3 3.3 0 0 1 5 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M6.5 18.5a5.5 5.5 0 0 1 11 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    default:
      return null;
  }
}

const navItems = [
  {
    href: "/staff-app/scm",
    label: "Live",
    icon: "overview" as const,
    match: (pathname: string) =>
      pathname === "/staff-app/scm" || pathname.startsWith("/staff-app/scm/live"),
  },
  {
    href: "/staff-app/scm/gigs",
    label: "Gigs",
    icon: "gigs" as const,
    match: (pathname: string) => pathname.startsWith("/staff-app/scm/gigs"),
  },
  {
    href: "/staff-app/scm/team",
    label: "Team",
    icon: "team" as const,
    match: (pathname: string) => pathname.startsWith("/staff-app/scm/team"),
  },
  {
    href: "/staff-app/scm/profile",
    label: "Profile",
    icon: "profile" as const,
    match: (pathname: string) => pathname.startsWith("/staff-app/scm/profile"),
  },
] as const;

export function StaffAppScmBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="staff-app-bottom-nav scm-ops" aria-label="SCM Staff primary">
      {navItems.map((item) => {
        const active = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`staff-app-bottom-link scm-ops${active ? " active" : ""}`}
          >
            <span className="staff-app-bottom-glyph" aria-hidden="true">
              <ScmBottomNavIcon kind={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
