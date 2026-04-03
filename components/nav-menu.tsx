"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function GigsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M19.14 12.94a7.96 7.96 0 0 0 .05-.94c0-.32-.02-.63-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.23 7.23 0 0 0-1.63-.94l-.36-2.54A.49.49 0 0 0 13.9 2h-3.8a.49.49 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.06.62-.06.94s.03.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.73 1.63.95l.36 2.53a.49.49 0 0 0 .49.42h3.8a.49.49 0 0 0 .49-.42l.36-2.53c.58-.22 1.13-.54 1.63-.95l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export function NavMenu({
  canAccessScmStaff,
  canAccessStaffDirectory,
  canManageSystemSettings,
  firstName,
  lastName,
  roleLabel,
  logoUrl,
  logoutAction,
}: {
  canAccessScmStaff: boolean;
  canAccessStaffDirectory: boolean;
  canManageSystemSettings: boolean;
  firstName: string;
  lastName: string;
  roleLabel: string;
  logoUrl: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  }

  return (
    <div className="nav-menu-wrap" ref={menuRef} data-text-edit-exclude="true">
      <button
        type="button"
        className={`nav-menu-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open && (
        <div className="nav-menu-dropdown" role="dialog" aria-label="Navigation menu">
          <div className="nav-menu-logo">
            <Image
              src={logoUrl}
              alt="SCM"
              width={72}
              height={26}
              unoptimized
              priority
            />
          </div>

          <div className="nav-menu-divider" style={{ marginTop: "0.1rem" }} />

          <nav className="nav-menu-section">
            <Link href="/dashboard" className={`nav-menu-item ${isActive("/dashboard") ? "active" : ""}`}>
              <span className="nav-menu-icon"><DashboardIcon /></span>
              <span className="nav-menu-label">Overview</span>
            </Link>

            <Link href="/gigs" className={`nav-menu-item ${isActive("/gigs") ? "active" : ""}`}>
              <span className="nav-menu-icon"><GigsIcon /></span>
              <span className="nav-menu-label">Gigs</span>
            </Link>

            {canAccessScmStaff && (
              <Link href="/scm-staff" className={`nav-menu-item ${isActive("/scm-staff") ? "active" : ""}`}>
                <span className="nav-menu-icon"><TeamIcon /></span>
                <span className="nav-menu-label">SCM Staff</span>
              </Link>
            )}

            {canAccessStaffDirectory && (
              <Link href="/people" className={`nav-menu-item ${isActive("/people") ? "active" : ""}`}>
                <span className="nav-menu-icon"><PersonIcon /></span>
                <span className="nav-menu-label">Staff</span>
              </Link>
            )}
          </nav>

          <div className="nav-menu-divider" />

          <div className="nav-menu-section">
            <Link href="/profile" className={`nav-menu-item ${isActive("/profile") ? "active" : ""}`}>
              <span className="nav-menu-icon"><PersonIcon /></span>
              <span className="nav-menu-label">My profile</span>
            </Link>

            {canManageSystemSettings && (
              <Link href="/system-settings" className={`nav-menu-item ${isActive("/system-settings") ? "active" : ""}`}>
                <span className="nav-menu-icon"><SettingsIcon /></span>
                <span className="nav-menu-label">Settings</span>
              </Link>
            )}

            <form action={logoutAction} className="nav-menu-form">
              <button type="submit" className="nav-menu-item nav-menu-logout">
                <span className="nav-menu-icon"><LogoutIcon /></span>
                <span className="nav-menu-label">Log out</span>
              </button>
            </form>
          </div>

          <div className="nav-menu-user">
            <strong className="nav-menu-user-name">{`${firstName} ${lastName}`}</strong>
            <span className="nav-menu-user-role">{roleLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
