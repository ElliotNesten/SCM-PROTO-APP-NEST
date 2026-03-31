"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavIconKind = "home" | "gigs" | "schedule" | "messages" | "profile";

function StaffAppBottomNavIcon({ kind }: { kind: NavIconKind }) {
  switch (kind) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m5 10.5 7-5.5 7 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-7Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
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
    case "schedule":
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
            d="M8 4v4M16 4v4M4 10h16"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.5 7.5h11A2.5 2.5 0 0 1 20 10v5a2.5 2.5 0 0 1-2.5 2.5h-6l-4.5 3v-3H6.5A2.5 2.5 0 0 1 4 15v-5a2.5 2.5 0 0 1 2.5-2.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M8 11h8M8 14h5"
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
          <circle
            cx="12"
            cy="9"
            r="3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
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
    href: "/staff-app/home",
    label: "Home",
    icon: "home" as const,
    match: (pathname: string) => pathname === "/staff-app/home",
  },
  {
    href: "/staff-app/gigs",
    label: "Gigs",
    icon: "gigs" as const,
    match: (pathname: string) =>
      pathname.startsWith("/staff-app/gigs") || pathname.startsWith("/staff-app/passes"),
  },
  {
    href: "/staff-app/schedule",
    label: "Schedule",
    icon: "schedule" as const,
    match: (pathname: string) =>
      pathname.startsWith("/staff-app/schedule") ||
      pathname.includes("/shifts/") ||
      pathname.startsWith("/staff-app/check-in"),
  },
  {
    href: "/staff-app/messages",
    label: "Messages",
    icon: "messages" as const,
    match: (pathname: string) => pathname.startsWith("/staff-app/messages"),
  },
  {
    href: "/staff-app/profile",
    label: "Profile",
    icon: "profile" as const,
    match: (pathname: string) =>
      pathname.startsWith("/staff-app/profile") ||
      pathname.startsWith("/staff-app/colleagues") ||
      pathname.startsWith("/staff-app/scm-info"),
  },
] as const;

export function StaffAppBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="staff-app-bottom-nav" aria-label="Primary">
      {navItems.map((item) => {
        const active = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`staff-app-bottom-link${active ? " active" : ""}`}
          >
            <span className="staff-app-bottom-glyph" aria-hidden="true">
              <StaffAppBottomNavIcon kind={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
