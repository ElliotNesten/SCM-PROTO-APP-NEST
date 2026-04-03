"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderActions({
  canCreateGig,
  canManageScmStaff,
}: {
  canCreateGig: boolean;
  canManageScmStaff: boolean;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/gigs") && canCreateGig) {
    return (
      <Link href="/gigs/new" className="button header-action-button">
        New Gig
      </Link>
    );
  }

  if (pathname.startsWith("/scm-staff") && canManageScmStaff) {
    return (
      <Link href="/scm-staff/new" className="button header-action-button">
        Add Staff
      </Link>
    );
  }

  return null;
}
