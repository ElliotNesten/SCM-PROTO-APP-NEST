import Link from "next/link";

import { formatStaffAppDate } from "@/lib/staff-app-data";
import { getStaffAppScmOperationsBoard } from "@/lib/staff-app-scm-ops";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

type StaffAppScmGigsPageProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

type BoardListView = "queue" | "closeout";

function getStatusToneClassName(
  operationalStatus: "live" | "upcoming" | "finished",
  requiresAttention: boolean,
) {
  if (requiresAttention) {
    return "danger";
  }

  if (operationalStatus === "live") {
    return "success";
  }

  if (operationalStatus === "upcoming") {
    return "warn";
  }

  return "neutral";
}

function normalizeBoardListView(value: string | undefined): BoardListView {
  return value === "closeout" ? "closeout" : "queue";
}

function ScmBoardMetricCard({
  label,
  value,
  copy,
  href,
}: {
  label: string;
  value: number;
  copy: string;
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{copy}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="staff-app-scm-live-metric staff-app-scm-live-metric-link">
        {content}
      </Link>
    );
  }

  return <article className="staff-app-scm-live-metric">{content}</article>;
}

export default async function StaffAppScmGigsPage({
  searchParams,
}: StaffAppScmGigsPageProps) {
  const profile = await requireCurrentStaffAppScmProfile();
  const resolvedSearchParams = (await searchParams) ?? {};
  const board = await getStaffAppScmOperationsBoard(profile);
  const listView = normalizeBoardListView(resolvedSearchParams.view);
  const listCards =
    listView === "closeout" ? board.closeoutGigCards : board.upcomingMonthGigCards;
  const listHeading = listView === "closeout" ? "To be closed" : "Gig queue";
  const listKicker = listView === "closeout" ? "Awaiting closeout" : "Upcoming next 30 days";
  const emptyStateCopy =
    listView === "closeout"
      ? "No gigs are currently waiting to be closed in this SCM scope."
      : "No upcoming gigs are scheduled within the next month in this SCM scope.";
  const metricLinkHref = "/staff-app/scm/gigs?view=closeout#gig-list";

  return (
    <section className="staff-app-screen staff-app-scm-screen staff-app-scm-live-screen staff-app-scm-gigs-screen">
      <div className="staff-app-card staff-app-scm-live-hero">
        <div className="staff-app-scm-live-hero-copy">
          <h1>Todays GIG&apos;s</h1>
        </div>

        <div className="staff-app-scm-board-today-list">
          {board.todayGigCards.length === 0 ? (
            <p className="staff-app-empty-state staff-app-scm-board-empty">
              No gigs are scheduled for today in your SCM scope.
            </p>
          ) : (
            board.todayGigCards.map((gig) => (
              <Link
                key={gig.id}
                href={`/staff-app/scm/live/${gig.id}`}
                className="staff-app-scm-board-today-item"
              >
                <div className="staff-app-scm-board-today-copy">
                  <strong>{gig.artist}</strong>
                  <p>
                    {gig.arena}, {gig.city}
                  </p>
                </div>

                <div className="staff-app-scm-board-today-meta">
                  <span>
                    {gig.startTime} - {gig.endTime}
                  </span>
                  <span
                    className={`staff-app-scm-status-pill ${getStatusToneClassName(gig.operationalStatus, gig.requiresAttention)}`}
                  >
                    {gig.gigStatus}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="staff-app-scm-live-metric-grid">
        <ScmBoardMetricCard
          label="This week"
          value={board.weekGigCount}
          copy="Gigs scheduled in the current week, with Sunday 23:59 as the cutoff."
        />
        <ScmBoardMetricCard
          label="To be closed"
          value={board.toBeClosedCount}
          copy="Gigs that are completed or reported and still waiting to be closed."
          href={metricLinkHref}
        />
      </div>

      <div className="staff-app-card" id="gig-list">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">{listKicker}</p>
            <h2>{listHeading}</h2>
          </div>
          {listView === "closeout" ? (
            <Link href="/staff-app/scm/gigs#gig-list" className="staff-app-button secondary compact">
              Show gig queue
            </Link>
          ) : null}
        </div>

        <div className="staff-app-scm-live-gig-list">
          {listCards.length === 0 ? (
            <p className="staff-app-empty-state">{emptyStateCopy}</p>
          ) : (
            listCards.map((gig) => (
              <Link
                key={gig.id}
                href={`/staff-app/scm/live/${gig.id}`}
                className={`staff-app-scm-live-gig-card${gig.requiresAttention ? " attention" : ""}`}
              >
                <div className="staff-app-scm-live-gig-head">
                  <div>
                    <strong>{gig.artist}</strong>
                    <p>
                      {gig.arena}, {gig.city}
                    </p>
                  </div>
                  <span className={`staff-app-scm-status-pill ${getStatusToneClassName(gig.operationalStatus, gig.requiresAttention)}`}>
                    {listView === "closeout" ? gig.gigStatus : gig.operationalStatusLabel}
                  </span>
                </div>

                <div className="staff-app-scm-live-inline-stats">
                  <span>{formatStaffAppDate(gig.date)}</span>
                  <span>
                    {gig.startTime} - {gig.endTime}
                  </span>
                  <span>{gig.gigStatus}</span>
                </div>

                <div className="staff-app-scm-live-inline-stats">
                  <span>{gig.onSiteCount}/{gig.plannedCount} on site</span>
                  <span>{gig.understaffedShiftCount} gaps</span>
                  <span>{gig.alertCount} alerts</span>
                </div>

                <p>{gig.summary}</p>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
