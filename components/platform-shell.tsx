import type { ReactNode } from "react";
import Link from "next/link";

import { logoutCurrentUser } from "@/app/auth-actions";
import { BrandLogoUploader } from "@/components/brand-logo-uploader";
import { ProfileImage } from "@/components/profile-image";
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
import { SidebarNav } from "@/components/sidebar-nav";

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
          <div className="platform-brand-nav">
            <BrandLogoUploader
              initialLogoUrl={brandSettings.logoUrl}
              canUpload={canManageSystemSettings}
            />

            <SidebarNav
              canAccessScmStaff={canAccessScmStaffDirectory(currentUser.roleKey)}
              canAccessStaffDirectory={canAccessStaffDirectory}
            />
          </div>

          <div className="platform-header-right">
            {canSearchPlatform ? <GlobalSearch /> : null}

            <div className="platform-session-actions">
              <form action={logoutCurrentUser}>
                <button type="submit" className="button ghost header-logout-button">
                  Log out
                </button>
              </form>

              <Link
                href="/profile"
                className="profile-chip"
                data-text-edit-exclude="true"
              >
                <span className="profile-avatar">
                  <ProfileImage
                    displayName={currentUser.displayName}
                    imageUrl={currentUser.profileImageUrl}
                    alt={`${currentUser.displayName} profile`}
                    className="profile-avatar-image"
                    fallbackText={currentUser.initials}
                  />
                </span>
                <span className="profile-copy">
                  <strong>{currentUser.displayName}</strong>
                  <small>{currentUser.roleLabel}</small>
                </span>
              </Link>

              {canManageSystemSettings ? (
                <Link
                  href="/system-settings"
                  className="button ghost header-settings-button"
                  aria-label="Open System Settings"
                  title="System Settings"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="header-settings-icon"
                  >
                    <path
                      fill="currentColor"
                      d="M19.14 12.94a7.96 7.96 0 0 0 .05-.94c0-.32-.02-.63-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.23 7.23 0 0 0-1.63-.94l-.36-2.54A.49.49 0 0 0 13.9 2h-3.8a.49.49 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.06.62-.06.94s.03.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.73 1.63.95l.36 2.53a.49.49 0 0 0 .49.42h3.8a.49.49 0 0 0 .49-.42l.36-2.53c.58-.22 1.13-.54 1.63-.95l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
                    />
                  </svg>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="main-shell">
        <div className="page-stack">{children}</div>
      </main>
    </div>
  );
}
