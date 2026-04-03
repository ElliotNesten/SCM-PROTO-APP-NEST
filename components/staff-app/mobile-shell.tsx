import type { ReactNode } from "react";
import Link from "next/link";

import { getStaffAppInitials } from "@/lib/staff-app-data";
import type { StaffAppAccount } from "@/types/staff-app";

import { StaffAppBottomNav } from "@/components/staff-app/bottom-nav";
import { StaffAppTopbarBrandLogo } from "@/components/staff-app/topbar-brand-logo";

function StaffAppBellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4a4 4 0 0 0-4 4v1.1c0 .85-.28 1.67-.79 2.35L6 13.2v1.3h12v-1.3l-1.21-1.75A4.1 4.1 0 0 1 16 9.1V8a4 4 0 0 0-4-4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10 17a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function StaffAppMobileShell({
  account,
  children,
}: {
  account: StaffAppAccount;
  children: ReactNode;
}) {
  const initials = getStaffAppInitials(`${account.firstName} ${account.lastName}`);

  return (
    <div className="staff-app-shell">
      <div className="staff-app-device">
        <header className="staff-app-topbar">
          <Link href="/staff-app/home" className="staff-app-brand-lockup" aria-label="Open home">
            <StaffAppTopbarBrandLogo />
          </Link>

          <div className="staff-app-topbar-actions">
            <Link
              href="/staff-app/messages"
              className="staff-app-topbar-action"
              aria-label="Open messages"
            >
              <StaffAppBellIcon />
            </Link>
            <Link
              href="/staff-app/profile"
              className="staff-app-avatar-chip"
              aria-label="Open profile"
            >
            {account.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.profileImageUrl} alt={`${account.firstName} ${account.lastName}`} />
            ) : (
              <span>{initials}</span>
            )}
            </Link>
          </div>
        </header>

        <main className="staff-app-main">{children}</main>

        <StaffAppBottomNav />
      </div>
    </div>
  );
}
