import Link from "next/link";

import { formatStaffAppCompactDate } from "@/lib/staff-app-data";
import type {
  StaffAppManagedGig,
  StaffAppOpenPass,
  StaffAppScheduledShift,
} from "@/types/staff-app";

export function StaffAppGigMetaIcon({ kind }: { kind: "calendar" | "pin" | "clock" }) {
  if (kind === "calendar") {
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
  }

  if (kind === "clock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M12 7.5v5h4.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20s5-4.5 5-9a5 5 0 1 0-10 0c0 4.5 5 9 5 9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="11" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function StaffAppGigArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function StaffAppGigArtwork({
  imageUrl,
  title,
  large = false,
}: {
  imageUrl?: string;
  title: string;
  large?: boolean;
}) {
  return (
    <div className={`staff-app-gig-artwork${large ? " large" : ""}${imageUrl ? "" : " fallback"}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={title} />
      ) : (
        <span>{title.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export function formatStaffAppGigLine(pass: StaffAppOpenPass) {
  return `${formatStaffAppCompactDate(pass.date)} | ${pass.startTime} - ${pass.endTime}`;
}

export function formatStaffAppScheduledShiftLine(shift: StaffAppScheduledShift) {
  return `${formatStaffAppCompactDate(shift.date)} | ${shift.startTime} - ${shift.endTime}`;
}

export function StaffAppGigOverviewCard({
  href,
  title,
  description,
  countLabel,
  accent = "default",
}: {
  href: string;
  title: string;
  description: string;
  countLabel: string;
  accent?: "default" | "primary";
}) {
  return (
    <Link href={href} className={`staff-app-gig-overview-card${accent === "primary" ? " primary" : ""}`}>
      <div className="staff-app-gig-overview-card-head">
        <span className="staff-app-gig-overview-icon">
          <StaffAppGigMetaIcon kind="calendar" />
        </span>
        <div className="staff-app-gig-overview-copy">
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <span className="staff-app-gig-overview-arrow">
          <StaffAppGigArrow />
        </span>
      </div>
      <span className="staff-app-gig-overview-count">{countLabel}</span>
    </Link>
  );
}

export function StaffAppGigFeedCard({
  pass,
  actionLabel,
  actionHref,
  badgeLabel,
}: {
  pass: StaffAppOpenPass;
  actionLabel?: string;
  actionHref?: string;
  badgeLabel?: string;
}) {
  return (
    <article
      className="staff-app-card staff-app-gig-feed-card"
      data-text-edit-exclude="true"
    >
      <StaffAppGigArtwork imageUrl={pass.imageUrl} title={pass.artist} />

      <div className="staff-app-gig-feed-copy">
        <strong>{pass.artist}</strong>
        <p>{pass.arena}</p>
        <div className="staff-app-gig-feed-tags">
          <p className="staff-app-gig-feed-role">{pass.role} pass</p>
          {pass.payRateLabel ? (
            <p className="staff-app-gig-feed-pay">{pass.payRateLabel}</p>
          ) : null}
        </div>

        <div className="staff-app-gig-feed-meta">
          <span>
            <StaffAppGigMetaIcon kind="calendar" />
            {formatStaffAppGigLine(pass)}
          </span>
          <span>
            <StaffAppGigMetaIcon kind="pin" />
            {pass.city}
          </span>
        </div>

        {pass.feed === "open" ? null : (
          <p className="staff-app-gig-feed-status">{pass.statusMessage}</p>
        )}
      </div>

      {actionHref && actionLabel ? (
        <Link href={actionHref} className="staff-app-gig-feed-action">
          {actionLabel}
        </Link>
      ) : badgeLabel ? (
        <span className="staff-app-gig-feed-badge">{badgeLabel}</span>
      ) : null}
    </article>
  );
}

export function StaffAppScheduledShiftCard({
  shift,
  actionLabel,
  actionHref,
  badgeLabel,
  statusLabel = "Booked shift",
}: {
  shift: StaffAppScheduledShift;
  actionLabel?: string;
  actionHref?: string;
  badgeLabel?: string;
  statusLabel?: string;
}) {
  return (
    <article
      className="staff-app-card staff-app-gig-feed-card"
      data-text-edit-exclude="true"
    >
      <StaffAppGigArtwork imageUrl={shift.imageUrl} title={shift.artist} />

      <div className="staff-app-gig-feed-copy">
        <strong>{shift.artist}</strong>
        <p>{shift.arena}</p>
        <div className="staff-app-gig-feed-tags">
          <p className="staff-app-gig-feed-role">{shift.role} shift</p>
        </div>

        <div className="staff-app-gig-feed-meta">
          <span>
            <StaffAppGigMetaIcon kind="calendar" />
            {formatStaffAppScheduledShiftLine(shift)}
          </span>
          <span>
            <StaffAppGigMetaIcon kind="pin" />
            {shift.city}
          </span>
        </div>

        <p className="staff-app-gig-feed-status">{statusLabel}</p>
      </div>

      {actionHref && actionLabel ? (
        <Link href={actionHref} className="staff-app-gig-feed-action">
          {actionLabel}
        </Link>
      ) : badgeLabel ? (
        <span className="staff-app-gig-feed-badge">{badgeLabel}</span>
      ) : null}
    </article>
  );
}

export function StaffAppManagedGigCard({
  gig,
}: {
  gig: StaffAppManagedGig;
}) {
  return (
    <article
      className="staff-app-card staff-app-gig-feed-card"
      data-text-edit-exclude="true"
    >
      <StaffAppGigArtwork imageUrl={gig.imageUrl} title={gig.artist} />

      <div className="staff-app-gig-feed-copy">
        <strong>{gig.artist}</strong>
        <p>{gig.arena}</p>

        <div className="staff-app-gig-feed-meta">
          <span>
            <StaffAppGigMetaIcon kind="calendar" />
            {formatStaffAppCompactDate(gig.date)} | {gig.startTime} - {gig.endTime}
          </span>
          <span>
            <StaffAppGigMetaIcon kind="pin" />
            {gig.city}
          </span>
        </div>

        <p className="staff-app-gig-feed-status">{gig.statusMessage}</p>
        <p className="staff-app-muted">
          Platform access until {formatStaffAppCompactDate(gig.accessEndsOn)}. Visible here until{" "}
          {formatStaffAppCompactDate(gig.visibleUntil)}.
        </p>
      </div>

      <span className="staff-app-gig-feed-badge">Manager</span>
    </article>
  );
}
