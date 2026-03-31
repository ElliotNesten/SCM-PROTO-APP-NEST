import Link from "next/link";

import { getScmRoleDefinition } from "@/types/scm-rbac";

import {
  getStaffAppScmGigWorkspace,
  getStaffAppScmOperationsBoard,
} from "@/lib/staff-app-scm-ops";
import { getStaffAppScmData } from "@/lib/staff-app-scm-data";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

function getToneClassName(tone: "neutral" | "success" | "warn" | "danger") {
  if (tone === "success") {
    return "success";
  }

  if (tone === "warn") {
    return "warn";
  }

  if (tone === "danger") {
    return "danger";
  }

  return "neutral";
}

export default async function StaffAppScmTeamPage() {
  const profile = await requireCurrentStaffAppScmProfile();
  const [scmData, board] = await Promise.all([
    getStaffAppScmData(profile),
    getStaffAppScmOperationsBoard(profile),
  ]);
  const liveWorkspace = board.primaryGigId
    ? await getStaffAppScmGigWorkspace(profile, board.primaryGigId)
    : null;

  return (
    <section className="staff-app-screen staff-app-scm-screen staff-app-scm-live-screen">
      <div className="staff-app-card staff-app-scm-live-hero">
        <div className="staff-app-scm-live-hero-copy">
          <p className="staff-app-kicker">Team focus</p>
          <h1>People who need follow-up</h1>
          <p>
            Operational view of SCM colleagues and the current gig roster, prioritised for rapid
            staffing decisions instead of directory browsing.
          </p>
        </div>

        {liveWorkspace ? (
          <div className="staff-app-scm-live-pill-row">
            <span className="staff-app-scm-live-pill">{liveWorkspace.gig.artist}</span>
            <span className="staff-app-scm-live-pill subtle">{liveWorkspace.operationalStatusLabel}</span>
          </div>
        ) : null}
      </div>

      {liveWorkspace ? (
        <div className="staff-app-card">
          <div className="staff-app-section-head compact">
            <div>
              <p className="staff-app-kicker">Current gig</p>
              <h2>Staff needing action</h2>
            </div>
            <Link href={`/staff-app/scm/live/${liveWorkspace.gig.id}`} className="staff-app-inline-link">
              Open live view
            </Link>
          </div>

          <div className="staff-app-scm-live-roster">
            {liveWorkspace.roster
              .filter((entry) => entry.tone === "danger" || entry.tone === "warn")
              .map((entry) => (
                <article key={entry.id} className="staff-app-scm-live-roster-card">
                  <div className="staff-app-scm-live-roster-copy">
                    <div className="staff-app-scm-live-roster-head">
                      <div>
                        <strong>{entry.staffName}</strong>
                        <p>{entry.shiftRole}</p>
                      </div>
                      <span className={`staff-app-scm-status-pill ${getToneClassName(entry.tone)}`}>
                        {entry.statusLabel}
                      </span>
                    </div>
                    <div className="staff-app-scm-live-inline-stats">
                      <span>{entry.staffPhone || entry.staffEmail || "No contact info"}</span>
                      <span>
                        {entry.shiftStartTime} - {entry.shiftEndTime}
                      </span>
                    </div>
                  </div>
                </article>
              ))}

            {liveWorkspace.roster.filter((entry) => entry.tone === "danger" || entry.tone === "warn").length === 0 ? (
              <p className="staff-app-empty-state">No roster issues need follow-up on the current primary gig.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">SCM support</p>
            <h2>Colleagues in scope</h2>
          </div>
        </div>

        <div className="staff-app-scm-list">
          {scmData.scmPeers.length === 0 ? (
            <p className="staff-app-empty-state">No additional SCM Staff profiles fall inside this scope.</p>
          ) : (
            scmData.scmPeers.map((peer) => (
              <article key={peer.id} className="staff-app-scm-person-card">
                <div className="staff-app-scm-person-copy">
                  <strong>{peer.displayName}</strong>
                  <p>{getScmRoleDefinition(peer.roleKey).label}</p>
                  <span>{peer.email}</span>
                </div>
                <span className="staff-app-badge neutral">
                  {peer.country === "Global" ? "Global" : peer.country}
                </span>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
