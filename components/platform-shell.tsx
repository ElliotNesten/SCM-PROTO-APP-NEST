import type { ReactNode } from "react";
import { Suspense } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { DashboardFilterButton } from "@/components/dashboard-filter-button";
import { getBrandSettings } from "@/lib/brand-store";
import { GlobalSearch } from "@/components/global-search";
import { HeaderActions } from "@/components/header-actions";
import { PlatformHeaderClient } from "@/components/platform-header-client";
import {
  canAccessScmStaffDirectory,
  canAccessScmStaffAdministration,
  getCurrentAuthenticatedUserSummary,
  isSuperAdminRole,
} from "@/lib/auth-session";
import {
  canAccessPlatformStaffDirectory,
  canCreatePlatformGigs,
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
  const canCreateGig = canCreatePlatformGigs(currentUser.roleKey);
  const canManageScmStaff = canAccessScmStaffAdministration(currentUser.roleKey);

  return (
    <div className="app-shell">
      <div className="shell-orb shell-orb-left" />
      <div className="shell-orb shell-orb-right" />
      <div className="shell-dots shell-dots-left" />
      <div className="shell-dots shell-dots-right" />

      <PlatformHeaderClient>
        {canSearchPlatform ? <GlobalSearch /> : null}
        <HeaderActions canCreateGig={canCreateGig} canManageScmStaff={canManageScmStaff} />
        <Suspense>
          <DashboardFilterButton />
        </Suspense>
      </PlatformHeaderClient>

      <main className="main-shell">
        <div className="page-stack">{children}</div>
      </main>

      <BottomNav
        canAccessScmStaff={canAccessScmStaffDirectory(currentUser.roleKey)}
        profileImageUrl={currentUser.profileImageUrl ?? ""}
        firstName={currentUser.firstName}
      />
    </div>
  );
}
