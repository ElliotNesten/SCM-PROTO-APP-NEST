import Link from "next/link";

import { StaffAppGigFeedCard } from "@/components/staff-app/gig-flow";
import { getStaffAppAttendanceState } from "@/lib/staff-app-attendance-store";
import { getStaffAppHomeOverview } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type HomeIconKind =
  | "schedule"
  | "attendance"
  | "records"
  | "info"
  | "shift"
  | "messages"
  | "team"
  | "status-pass"
  | "status-shift";

function StaffAppHomeIcon({ kind }: { kind: HomeIconKind }) {
  switch (kind) {
    case "schedule":
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
    case "attendance":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 4.5v3M16 4.5v3M6 9.5h12"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
          <rect
            x="4"
            y="6.5"
            width="16"
            height="13"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m9 14 2 2 4-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "status-pass":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 7.5h10A2.5 2.5 0 0 1 19.5 10a2.5 2.5 0 0 0 0 4A2.5 2.5 0 0 1 17 16.5H7A2.5 2.5 0 0 1 4.5 14a2.5 2.5 0 0 0 0-4A2.5 2.5 0 0 1 7 7.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M12 8.5v7"
            fill="none"
            stroke="currentColor"
            strokeDasharray="1.5 2"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "records":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 4.5h6l4 4v10A1.5 1.5 0 0 1 16.5 20h-8A1.5 1.5 0 0 1 7 18.5v-12A2 2 0 0 1 8 4.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M14 4.5v4h4M10 12h4M10 15h4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 9.5 12 5l7.5 4.5-7.5 4.5-7.5-4.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M8.5 12.2V15c0 .8 1.6 1.8 3.5 1.8s3.5-1 3.5-1.8v-2.8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "shift":
    case "status-shift":
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
    case "messages":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.5 7.5h11A2.5 2.5 0 0 1 20 10v5a2.5 2.5 0 0 1-2.5 2.5h-6l-4.5 3v-3H6.5A2.5 2.5 0 0 1 4 15v-5a2.5 2.5 0 0 1 2.5-2.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M8 11h8M8 14h5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "team":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle
            cx="9"
            cy="10"
            r="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle
            cx="16.5"
            cy="9"
            r="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M5.5 18.5a4.2 4.2 0 0 1 7 0M14.5 17.5a3.5 3.5 0 0 1 5 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    default:
      return null;
  }
}

function StaffAppChevronIcon() {
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

function HomeActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: HomeIconKind;
}) {
  return (
    <Link href={href} className="staff-app-home-action-card">
      <span className="staff-app-home-action-icon">
        <StaffAppHomeIcon kind={icon} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
    </Link>
  );
}

function HomeStatusCard({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: "status-pass" | "status-shift";
}) {
  return (
    <article className="staff-app-home-status-card">
      <span className="staff-app-home-status-icon">
        <StaffAppHomeIcon kind={icon} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function HomeStackCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: "messages" | "team";
}) {
  return (
    <Link href={href} className="staff-app-home-stack-card">
      <div className="staff-app-home-stack-card-copy">
        <span className="staff-app-home-stack-icon">
          <StaffAppHomeIcon kind={icon} />
        </span>
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
      </div>
      <span className="staff-app-home-card-arrow">
        <StaffAppChevronIcon />
      </span>
    </Link>
  );
}

export default async function StaffAppHomePage() {
  const account = await requireCurrentStaffAppAccount();
  const [overview, attendanceState] = await Promise.all([
    getStaffAppHomeOverview(account),
    getStaffAppAttendanceState(account),
  ]);
  const scheduleSummary = overview.nextShift
    ? "Upcoming booked shifts."
    : "Upcoming booked shifts.";
  const recordSummary = "Payslips and contracts.";
  const scmInfoSummary = "Policy, roles, and equipment.";
  const messageSummary =
    overview.unreadMessageCount > 0
      ? `${overview.unreadMessageCount} shift message${overview.unreadMessageCount === 1 ? "" : "s"} linked to your bookings.`
      : "Open active shift-linked chats with your manager.";
  const attendanceSummary = attendanceState.todayShift
    ? attendanceState.checkedOutAt
      ? "Time reporting completed."
      : attendanceState.checkedInAt
        ? "Time reporting in progress."
        : "Time reporting."
    : attendanceState.nextShift
      ? "Time reporting."
      : "Available on the same day as your booked shift.";
  const colleagueSummary = `Only teammates in ${account.country} and ${account.region} are shown.`;
  const featuredOpenPasses = overview.openPasses.slice(0, 2);
  const remainingOpenPassCount = Math.max(0, overview.openPasses.length - featuredOpenPasses.length);

  return (
    <section className="staff-app-screen staff-app-home-screen">
      <div className="staff-app-card emphasis staff-app-home-hero">
        <div className="staff-app-home-hero-copy">
          <h1>Upcoming Gigs</h1>
          <p>Open shifts that match your profile are shown here so you can apply directly.</p>
        </div>

        {featuredOpenPasses.length === 0 ? (
          <div className="staff-app-home-empty-note">
            <p>No open gigs currently match your staff eligibility.</p>
            <Link href="/staff-app/gigs" className="staff-app-inline-link">
              View open gigs
            </Link>
          </div>
        ) : (
          <div className="staff-app-home-open-pass-list">
            {featuredOpenPasses.map((pass) => (
              <StaffAppGigFeedCard
                key={pass.id}
                pass={pass}
                actionLabel="Apply"
                actionHref={`/staff-app/gigs/${pass.id}`}
              />
            ))}

            {remainingOpenPassCount > 0 ? (
              <Link href="/staff-app/gigs" className="staff-app-inline-link staff-app-home-hero-link">
                See all open gigs ({overview.openPasses.length})
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <div className="staff-app-home-action-grid">
        <HomeActionCard
          href="/staff-app/schedule"
          title="My Schedule"
          description={scheduleSummary}
          icon="schedule"
        />
        <HomeActionCard
          href="/staff-app/check-in"
          title="Check In / Out"
          description={attendanceSummary}
          icon="attendance"
        />
        <HomeActionCard
          href="/staff-app/documents"
          title="Records"
          description={recordSummary}
          icon="records"
        />
        <HomeActionCard
          href="/staff-app/scm-info"
          title="SCM Info"
          description={scmInfoSummary}
          icon="info"
        />
      </div>

      <div className="staff-app-home-section">
        <p className="staff-app-home-section-label">Status</p>
        <div className="staff-app-home-status-grid">
          <HomeStatusCard value={overview.openPassesCount} label="Eligible passes" icon="status-pass" />
          <HomeStatusCard value={overview.upcomingShiftCount} label="Booked shifts" icon="status-shift" />
        </div>
      </div>

      <div className="staff-app-home-section">
        <p className="staff-app-home-section-label">More</p>
        <div className="staff-app-home-stack">
          <HomeStackCard
            href="/staff-app/messages"
            title="Messages"
            description={messageSummary}
            icon="messages"
          />
          <HomeStackCard
            href="/staff-app/colleagues"
            title="My Colleagues"
            description={colleagueSummary}
            icon="team"
          />
        </div>
      </div>
    </section>
  );
}
