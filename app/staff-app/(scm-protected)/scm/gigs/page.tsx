import Link from "next/link";

import { formatStaffAppDate } from "@/lib/staff-app-data";
import { getStaffAppScmOperationsBoard } from "@/lib/staff-app-scm-ops";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

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

export default async function StaffAppScmGigsPage() {
  const profile = await requireCurrentStaffAppScmProfile();
  const board = await getStaffAppScmOperationsBoard(profile);

  return (
    <section className="staff-app-screen staff-app-scm-screen staff-app-scm-live-screen">
      <div className="staff-app-card staff-app-scm-live-hero">
        <div className="staff-app-scm-live-hero-copy">
          <p className="staff-app-kicker">Gig board</p>
          <h1>Operations in your scope</h1>
          <p>
            Live gigs, today&apos;s load, and next actions are ordered here so Regional Managers
            and Temporary Gig Managers can jump straight into the right event.
          </p>
        </div>

        <div className="staff-app-scm-live-pill-row">
          <span className="staff-app-scm-live-pill">{board.roleLabel}</span>
          <span className="staff-app-scm-live-pill subtle">{board.scopeLabel}</span>
        </div>

        {board.primaryGigId ? (
          <Link href={`/staff-app/scm/live/${board.primaryGigId}`} className="staff-app-button">
            Open primary live view
          </Link>
        ) : null}
      </div>

      <div className="staff-app-scm-live-metric-grid">
        <article className="staff-app-scm-live-metric">
          <span>Live now</span>
          <strong>{board.liveGigCount}</strong>
          <p>Gigs currently inside an active operational window.</p>
        </article>
        <article className="staff-app-scm-live-metric">
          <span>Today</span>
          <strong>{board.todayGigCount}</strong>
          <p>Events dated for today in the logged-in SCM scope.</p>
        </article>
        <article className="staff-app-scm-live-metric">
          <span>Need action</span>
          <strong>{board.requiresAttentionCount}</strong>
          <p>Gigs carrying late arrivals, gaps, or alerts that need follow-up.</p>
        </article>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Sorted for operations</p>
            <h2>Gig queue</h2>
          </div>
        </div>

        <div className="staff-app-scm-live-gig-list">
          {board.gigCards.length === 0 ? (
            <p className="staff-app-empty-state">No gigs are currently visible in this SCM role scope.</p>
          ) : (
            board.gigCards.map((gig) => (
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
                    {gig.operationalStatusLabel}
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
