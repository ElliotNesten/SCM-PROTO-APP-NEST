"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function getPageTitle(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/") return "Home";
  if (pathname.startsWith("/gigs/")) return "Gig details";
  if (pathname === "/gigs" || pathname === "/gigs/new") return "All gigs";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/scm-staff/")) return "Staff details";
  if (pathname === "/scm-staff" || pathname === "/scm-staff/new") return "Staff";
  if (pathname.startsWith("/people")) return "People";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/system-settings")) return "Settings";
  return "SCM";
}

export function PlatformHeaderClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Header shows on all pages now

  const pageTitle = getPageTitle(pathname);

  return (
    <>
      <header className="platform-header">
        <div className="platform-header-left">
          <Image
            src="/brand/scm-logo-black.png"
            alt="SCM"
            width={48}
            height={20}
            className="platform-logo"
            priority
          />
          <span className="platform-page-title">{pageTitle}</span>
        </div>
      </header>
      <div className="floating-toolbar">
        {children}
      </div>
    </>
  );
}
