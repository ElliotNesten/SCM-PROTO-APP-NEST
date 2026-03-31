"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryNav } from "@/data/scm-data";

export function SidebarNav({
  canAccessScmStaff,
  canAccessStaffDirectory,
}: {
  canAccessScmStaff: boolean;
  canAccessStaffDirectory: boolean;
}) {
  const pathname = usePathname();
  const topLevelItems = primaryNav.filter((item) => {
    if (item.href === "/profile") {
      return false;
    }

    if (item.href === "/people" && !canAccessStaffDirectory) {
      return false;
    }

    if (item.href === "/scm-staff" && !canAccessScmStaff) {
      return false;
    }

    return true;
  });

  return (
    <nav
      className="top-nav"
      aria-label="Primary navigation"
      data-text-edit-exclude="true"
    >
      {topLevelItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        const label = item.href === "/dashboard" ? "Overview" : item.label;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`top-nav-link ${isActive ? "active" : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
