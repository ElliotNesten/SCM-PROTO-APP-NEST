import type { ReactNode } from "react";
import Link from "next/link";

import { getStaffAppInitials } from "@/lib/staff-app-data";
import { formatStaffAppScmScopeLabel } from "@/lib/staff-app-scm-data";
import { getScmRoleDefinition, type StoredScmStaffProfile } from "@/types/scm-rbac";

import { StaffAppScmBottomNav } from "@/components/staff-app/scm-bottom-nav";
import { StaffAppTopbarBrandLogo } from "@/components/staff-app/topbar-brand-logo";

function StaffAppScmDashboardIcon() {
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
}

export function StaffAppScmMobileShell({
  profile,
  children,
}: {
  profile: StoredScmStaffProfile;
  children: ReactNode;
}) {
  const initials = getStaffAppInitials(`${profile.firstName} ${profile.lastName}`);
  const roleLabel = getScmRoleDefinition(profile.roleKey).label;
  const scopeLabel = formatStaffAppScmScopeLabel(profile);

  return (
    <div className="staff-app-shell scm-ops">
      <div className="staff-app-device scm-ops">
        <header className="staff-app-topbar scm-ops">
          <div className="staff-app-scm-topbar-content">
            <Link href="/staff-app/scm" className="staff-app-brand-lockup scm-ops" aria-label="Open SCM overview">
              <span className="staff-app-topbar-kicker">SCM Staff</span>
              <StaffAppTopbarBrandLogo />
            </Link>

            <div className="staff-app-scm-topbar-meta">
              <span className="staff-app-scm-topbar-pill">{roleLabel}</span>
              <span className="staff-app-scm-topbar-scope">{scopeLabel}</span>
            </div>
          </div>

          <div className="staff-app-topbar-actions">
            <Link
              href="/staff-app/scm/gigs"
              className="staff-app-topbar-action scm-ops"
              aria-label="Open SCM gigs"
            >
              <StaffAppScmDashboardIcon />
            </Link>
            <Link
              href="/staff-app/scm/profile"
              className="staff-app-avatar-chip scm-ops"
              aria-label="Open SCM profile"
            >
              {profile.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profileImageUrl} alt={`${profile.firstName} ${profile.lastName}`} />
              ) : (
                <span>{initials}</span>
              )}
            </Link>
          </div>
        </header>

        <main className="staff-app-main scm-ops">{children}</main>

        <StaffAppScmBottomNav />
      </div>
    </div>
  );
}
