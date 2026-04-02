import Link from "next/link";

import { getScmStaffScopeSummary } from "@/lib/scm-staff-store";
import { getScmRoleDefinition, scmStaffRoleOrder, type ScmStaffRoleKey } from "@/types/scm-rbac";

import {
  getStaffAppScmGigWorkspace,
  getStaffAppScmOperationsBoard,
} from "@/lib/staff-app-scm-ops";
import { getStaffAppScmData } from "@/lib/staff-app-scm-data";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

type StaffAppScmTeamPageProps = {
  searchParams?: Promise<{
    view?: string;
    role?: string;
  }>;
};

type StaffAppScmTeamView = "follow-up" | "scm-staff";
type StaffAppScmRoleFilter = "all" | ScmStaffRoleKey;

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

function getRoleBadgeTone(roleKey: ScmStaffRoleKey) {
  if (roleKey === "superAdmin") {
    return "alert";
  }

  if (roleKey === "regionalManager") {
    return "success";
  }

  return "neutral";
}

function normalizeTeamView(value: string | undefined): StaffAppScmTeamView {
  return value === "scm-staff" ? "scm-staff" : "follow-up";
}

function normalizeRoleFilter(value: string | undefined): StaffAppScmRoleFilter {
  if (
    value === "superAdmin" ||
    value === "officeStaff" ||
    value === "regionalManager" ||
    value === "temporaryGigManager"
  ) {
    return value;
  }

  return "all";
}

function buildTeamViewHref(view: StaffAppScmTeamView, roleFilter: StaffAppScmRoleFilter) {
  const params = new URLSearchParams();

  if (view === "scm-staff") {
    params.set("view", view);

    if (roleFilter !== "all") {
      params.set("role", roleFilter);
    }
  }

  const query = params.toString();
  return query ? `/staff-app/scm/team?${query}` : "/staff-app/scm/team";
}

function buildScmRoleFilterHref(roleFilter: StaffAppScmRoleFilter) {
  const params = new URLSearchParams({
    view: "scm-staff",
  });

  if (roleFilter !== "all") {
    params.set("role", roleFilter);
  }

  return `/staff-app/scm/team?${params.toString()}`;
}

function getTeamViewFilterClassName(isActive: boolean) {
  return `staff-app-scm-live-pill staff-app-scm-live-pill-link${isActive ? "" : " subtle"}`;
}

export default async function StaffAppScmTeamPage({
  searchParams,
}: StaffAppScmTeamPageProps) {
  const profile = await requireCurrentStaffAppScmProfile();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [scmData, board] = await Promise.all([
    getStaffAppScmData(profile),
    getStaffAppScmOperationsBoard(profile),
  ]);
  const view = normalizeTeamView(resolvedSearchParams.view);
  const roleFilter = normalizeRoleFilter(resolvedSearchParams.role);
  const liveWorkspace = board.primaryGigId
    ? await getStaffAppScmGigWorkspace(profile, board.primaryGigId)
    : null;
  const rosterEntries =
    liveWorkspace?.roster.filter((entry) => entry.tone === "danger" || entry.tone === "warn") ?? [];
  const visibleScmStaff =
    roleFilter === "all"
      ? scmData.scmDirectoryProfiles
      : scmData.scmDirectoryProfiles.filter((candidate) => candidate.roleKey === roleFilter);
  const roleFilterOptions: Array<{ value: StaffAppScmRoleFilter; label: string }> = [
    { value: "all", label: "All roles" },
    ...scmStaffRoleOrder.map((roleKey) => ({
      value: roleKey,
      label: getScmRoleDefinition(roleKey).label,
    })),
  ];
  const heroTitle =
    view === "scm-staff" ? "All SCM staff in scope" : "People who need follow-up";
  const heroCopy =
    view === "scm-staff"
      ? "Browse every SCM staff profile your current SCM login is allowed to see, using the same access scope logic as the platform."
      : "Operational view of SCM colleagues and the current gig roster, prioritised for rapid staffing decisions instead of directory browsing.";

  return (
    <section className="staff-app-screen staff-app-scm-screen staff-app-scm-live-screen">
      <div className="staff-app-card staff-app-scm-live-hero">
        <div className="staff-app-scm-live-hero-copy">
          <p className="staff-app-kicker">Team focus</p>
          <h1>{heroTitle}</h1>
          <p>{heroCopy}</p>
        </div>

        <div className="staff-app-scm-live-pill-row">
          <Link
            href={buildTeamViewHref("follow-up", roleFilter)}
            className={getTeamViewFilterClassName(view === "follow-up")}
          >
            Follow-up
          </Link>
          <Link
            href={buildTeamViewHref("scm-staff", roleFilter)}
            className={getTeamViewFilterClassName(view === "scm-staff")}
          >
            All SCM staff
          </Link>
        </div>

        {view === "follow-up" && liveWorkspace ? (
          <p className="staff-app-scm-support-copy">
            Primary gig: {liveWorkspace.gig.artist} • {liveWorkspace.operationalStatusLabel}
          </p>
        ) : null}

        {view === "scm-staff" ? (
          <p className="staff-app-scm-support-copy">
            {scmData.metrics.scmDirectoryCount} accessible SCM staff profile
            {scmData.metrics.scmDirectoryCount === 1 ? "" : "s"} in your current login scope.
          </p>
        ) : null}
      </div>

      {view === "follow-up" && liveWorkspace ? (
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
            {rosterEntries.map((entry) => (
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

            {rosterEntries.length === 0 ? (
              <p className="staff-app-empty-state">No roster issues need follow-up on the current primary gig.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {view === "follow-up" ? (
        <div className="staff-app-card">
          <div className="staff-app-section-head compact">
            <div>
              <p className="staff-app-kicker">SCM support</p>
              <h2>Colleagues in scope</h2>
            </div>
            <Link href={buildTeamViewHref("scm-staff", roleFilter)} className="staff-app-inline-link">
              Open SCM staff
            </Link>
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
      ) : (
        <div className="staff-app-card">
          <div className="staff-app-section-head compact">
            <div>
              <p className="staff-app-kicker">SCM directory</p>
              <h2>All SCM staff</h2>
            </div>
            <span className="staff-app-badge neutral">{visibleScmStaff.length} visible</span>
          </div>

          <div className="staff-app-scm-directory-filter-row">
            {roleFilterOptions.map((option) => (
              <Link
                key={option.value}
                href={buildScmRoleFilterHref(option.value)}
                className={`staff-app-scm-directory-filter${roleFilter === option.value ? " active" : ""}`}
              >
                {option.label}
              </Link>
            ))}
          </div>

          <p className="staff-app-scm-directory-note">
            The list below follows the same SCM role access scope as the platform and updates from the current SCM login.
          </p>

          <div className="staff-app-scm-list">
            {visibleScmStaff.length === 0 ? (
              <p className="staff-app-empty-state">
                No SCM Staff profiles match this role inside your current access scope.
              </p>
            ) : (
              visibleScmStaff.map((peer) => {
                const roleDefinition = getScmRoleDefinition(peer.roleKey);
                const scopeSummary = getScmStaffScopeSummary(peer);

                return (
                  <article key={peer.id} className="staff-app-scm-person-card">
                    <div className="staff-app-scm-person-copy">
                      <strong>{peer.displayName}</strong>
                      <p>{scopeSummary || roleDefinition.scopeLabel}</p>
                      <span>{peer.email}</span>
                    </div>

                    <div className="staff-app-scm-person-badge-stack">
                      <span className={`staff-app-badge ${getRoleBadgeTone(peer.roleKey)}`}>
                        {roleDefinition.label}
                      </span>
                      {peer.id === profile.id ? (
                        <span className="staff-app-badge success">You</span>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
