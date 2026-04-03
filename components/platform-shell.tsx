import type { ReactNode } from "react";
import { Suspense } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { DashboardFilterButton } from "@/components/dashboard-filter-button";
import { getBrandSettings } from "@/lib/brand-store";
import { GlobalSearch } from "@/components/global-search";
import {
  canAccessScmStaffDirectory,
  getCurrentAuthenticatedUserSummary,
  isSuperAdminRole,
} from "@/lib/auth-session";
import {
  canAccessPlatformStaffDirectory,
  canUsePlatformGlobalSearch,
} from "@/lib/platform-access";

export async function PlatformShell({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentAuthenticatedUserSummary();
  const brandSettings = await getBrandSettings();

  if (!currentUser) {
    return null;
  }

  const canManageSystemSettings = isSuperAdminRole(currentUser.roleKey);
  const canAccessStaffDirectory = canAccessPlatformStaffDirectory(currentUser.roleKey);
  const canSearchPlatform = canUsePlatformGlobalSearch(currentUser.roleKey);

  return (
    <div className="app-shell">
      <div className="shell-orb shell-orb-left" />
      <div className="shell-orb shell-orb-right" />
      <div className="shell-dots shell-dots-left" />
      <div className="shell-dots shell-dots-right" />

      <header className="platform-header">
        <div className="platform-nav-row">
          <div className="platform-header-right">
            {canSearchPlatform ? <GlobalSearch /> : null}
            <Suspense>
              <DashboardFilterButton />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="main-shell">
        <div className="page-stack">{children}</div>
      </main>

      <BottomNav
        canAccessScmStaff={canAccessScmStaffDirectory(currentUser.roleKey)}
        profileImageUrl={currentUser.profileImageUrl ?? ""}
        displayName={currentUser.displayName}
      />
    </div>
  );
}
