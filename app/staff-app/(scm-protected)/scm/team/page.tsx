import Link from "next/link";

import { getScmStaffScopeSummary } from "@/lib/scm-staff-store";
import { getStaffAppScmData } from "@/lib/staff-app-scm-data";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";
import { getScmRoleDefinition, scmStaffRoleOrder, type ScmStaffRoleKey } from "@/types/scm-rbac";
import { staffRoleKeys, type StaffRoleKey } from "@/types/staff-role";

type StaffAppScmTeamPageProps = {
  searchParams?: Promise<{
    view?: string;
    role?: string;
    country?: string;
    permission?: string;
  }>;
};

type StaffAppScmTeamView = "staff" | "scm-staff";
type StaffAppScmRoleFilter = "all" | ScmStaffRoleKey;
type StaffAppFieldStaffPermissionFilter = "all" | StaffRoleKey;
type TeamRouteState = {
  view: StaffAppScmTeamView;
  roleFilter: StaffAppScmRoleFilter;
  countryFilter: string;
  permissionFilter: StaffAppFieldStaffPermissionFilter;
};

function getRoleBadgeTone(roleKey: ScmStaffRoleKey) {
  if (roleKey === "superAdmin") {
    return "alert";
  }

  if (roleKey === "regionalManager") {
    return "success";
  }

  return "neutral";
}

function getStaffApprovalBadgeTone(approvalStatus: "Approved" | "Applicant" | "Archived") {
  if (approvalStatus === "Approved") {
    return "success";
  }

  if (approvalStatus === "Applicant") {
    return "alert";
  }

  return "neutral";
}

function normalizeTeamView(value: string | undefined): StaffAppScmTeamView {
  return value === "scm-staff" ? "scm-staff" : "staff";
}

function normalizeScmRoleFilter(value: string | undefined): StaffAppScmRoleFilter {
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

function normalizeStaffPermissionFilter(
  value: string | undefined,
): StaffAppFieldStaffPermissionFilter {
  return staffRoleKeys.includes(value as StaffRoleKey) ? (value as StaffRoleKey) : "all";
}

function normalizeCountryFilter(value: string | undefined, countryOptions: string[]) {
  return countryOptions.includes(value ?? "") ? (value ?? "") : "all";
}

function buildTeamHref({
  view,
  roleFilter,
  countryFilter,
  permissionFilter,
}: TeamRouteState) {
  const params = new URLSearchParams();

  if (view === "scm-staff") {
    params.set("view", view);
  }

  if (roleFilter !== "all") {
    params.set("role", roleFilter);
  }

  if (countryFilter !== "all") {
    params.set("country", countryFilter);
  }

  if (permissionFilter !== "all") {
    params.set("permission", permissionFilter);
  }

  const query = params.toString();
  return query ? `/staff-app/scm/team?${query}` : "/staff-app/scm/team";
}

function buildTeamViewHref(view: StaffAppScmTeamView, state: TeamRouteState) {
  return buildTeamHref({ ...state, view });
}

function buildScmRoleFilterHref(roleFilter: StaffAppScmRoleFilter, state: TeamRouteState) {
  return buildTeamHref({ ...state, view: "scm-staff", roleFilter });
}

function buildStaffCountryFilterHref(countryFilter: string, state: TeamRouteState) {
  return buildTeamHref({ ...state, view: "staff", countryFilter });
}

function buildStaffPermissionFilterHref(
  permissionFilter: StaffAppFieldStaffPermissionFilter,
  state: TeamRouteState,
) {
  return buildTeamHref({ ...state, view: "staff", permissionFilter });
}

function getTeamViewFilterClassName(isActive: boolean) {
  return `staff-app-scm-live-pill staff-app-scm-live-pill-link${isActive ? "" : " subtle"}`;
}

function formatFieldStaffPermissions(roles: string[]) {
  return roles.length > 0 ? roles.join(" | ") : "No permissions assigned";
}

function formatFieldStaffLocation(country: string, regions: string[], fallbackRegion: string) {
  const locationSummary = Array.from(new Set([...regions, fallbackRegion].filter(Boolean))).join(", ");

  return locationSummary ? `${country} | ${locationSummary}` : country;
}

export default async function StaffAppScmTeamPage({
  searchParams,
}: StaffAppScmTeamPageProps) {
  const profile = await requireCurrentStaffAppScmProfile();
  const resolvedSearchParams = (await searchParams) ?? {};
  const scmData = await getStaffAppScmData(profile);
  const countryOptions = Array.from(
    new Set(
      scmData.fieldStaffProfiles
        .map((candidate) => candidate.country.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const view = normalizeTeamView(resolvedSearchParams.view);
  const roleFilter = normalizeScmRoleFilter(resolvedSearchParams.role);
  const countryFilter = normalizeCountryFilter(resolvedSearchParams.country, countryOptions);
  const permissionFilter = normalizeStaffPermissionFilter(resolvedSearchParams.permission);
  const routeState: TeamRouteState = {
    view,
    roleFilter,
    countryFilter,
    permissionFilter,
  };
  const visibleFieldStaff = scmData.fieldStaffProfiles.filter((candidate) => {
    const matchesCountry = countryFilter === "all" ? true : candidate.country === countryFilter;
    const matchesPermission =
      permissionFilter === "all" ? true : candidate.roles.includes(permissionFilter);

    return matchesCountry && matchesPermission;
  });
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
  const permissionFilterOptions: Array<{
    value: StaffAppFieldStaffPermissionFilter;
    label: string;
  }> = [
    { value: "all", label: "All permissions" },
    ...staffRoleKeys.map((roleKey): {
      value: StaffAppFieldStaffPermissionFilter;
      label: string;
    } => ({
      value: roleKey,
      label: roleKey,
    })),
  ];
  const countryFilterOptions = ["all", ...countryOptions];
  const heroTitle = view === "scm-staff" ? "SCM staff in scope" : "Staff in scope";
  const heroCopy =
    view === "scm-staff"
      ? "Browse every SCM staff profile your current SCM login is allowed to see, using the same access scope logic as the platform."
      : "Browse every field staff profile your current SCM login can access, then narrow the list by country and permission.";

  return (
    <section className="staff-app-screen staff-app-scm-screen staff-app-scm-live-screen">
      <div className="staff-app-card staff-app-scm-live-hero">
        <div className="staff-app-scm-live-hero-copy">
          <p className="staff-app-kicker">Team directory</p>
          <h1>{heroTitle}</h1>
          <p>{heroCopy}</p>
        </div>

        <div className="staff-app-scm-live-pill-row">
          <Link
            href={buildTeamViewHref("staff", routeState)}
            className={getTeamViewFilterClassName(view === "staff")}
          >
            STAFF
          </Link>
          <Link
            href={buildTeamViewHref("scm-staff", routeState)}
            className={getTeamViewFilterClassName(view === "scm-staff")}
          >
            SCM staff
          </Link>
        </div>

        <p className="staff-app-scm-support-copy">
          {view === "scm-staff"
            ? `${scmData.metrics.scmDirectoryCount} accessible SCM staff profile${scmData.metrics.scmDirectoryCount === 1 ? "" : "s"} in your current login scope.`
            : `${scmData.metrics.fieldStaffCount} accessible staff profile${scmData.metrics.fieldStaffCount === 1 ? "" : "s"} in your current login scope.`}
        </p>
      </div>

      {view === "staff" ? (
        <div className="staff-app-card">
          <div className="staff-app-section-head compact">
            <div>
              <p className="staff-app-kicker">Field staff</p>
              <h2>All staff profiles</h2>
            </div>
            <span className="staff-app-badge neutral">{visibleFieldStaff.length} visible</span>
          </div>

          <p className="staff-app-kicker">Country</p>
          <div className="staff-app-scm-directory-filter-row">
            {countryFilterOptions.map((option) => {
              const isAllOption = option === "all";
              const label = isAllOption ? "All countries" : option;

              return (
                <Link
                  key={option}
                  href={buildStaffCountryFilterHref(option, routeState)}
                  className={`staff-app-scm-directory-filter${countryFilter === option ? " active" : ""}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <p className="staff-app-kicker">Permissions</p>
          <div className="staff-app-scm-directory-filter-row">
            {permissionFilterOptions.map((option) => (
              <Link
                key={option.value}
                href={buildStaffPermissionFilterHref(option.value, routeState)}
                className={`staff-app-scm-directory-filter${permissionFilter === option.value ? " active" : ""}`}
              >
                {option.label}
              </Link>
            ))}
          </div>

          <p className="staff-app-scm-directory-note">
            The list below follows the same staff access scope as the platform and only shows profiles
            this SCM login is allowed to see.
          </p>

          <div className="staff-app-scm-list">
            {visibleFieldStaff.length === 0 ? (
              <p className="staff-app-empty-state">
                No staff profiles match this country and permission filter inside your current access
                scope.
              </p>
            ) : (
              visibleFieldStaff.map((candidate) => (
                <article key={candidate.id} className="staff-app-scm-person-card">
                  <div className="staff-app-scm-person-copy">
                    <strong>{candidate.displayName}</strong>
                    <p>{formatFieldStaffPermissions(candidate.roles)}</p>
                    <span>{candidate.email}</span>
                    <span>
                      {formatFieldStaffLocation(
                        candidate.country,
                        candidate.regions,
                        candidate.region,
                      )}
                    </span>
                  </div>

                  <div className="staff-app-scm-person-badge-stack">
                    <span className="staff-app-badge neutral">{candidate.country}</span>
                    <span
                      className={`staff-app-badge ${getStaffApprovalBadgeTone(candidate.approvalStatus)}`}
                    >
                      {candidate.approvalStatus}
                    </span>
                  </div>
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
              <h2>SCM staff</h2>
            </div>
            <span className="staff-app-badge neutral">{visibleScmStaff.length} visible</span>
          </div>

          <p className="staff-app-kicker">Role</p>
          <div className="staff-app-scm-directory-filter-row">
            {roleFilterOptions.map((option) => (
              <Link
                key={option.value}
                href={buildScmRoleFilterHref(option.value, routeState)}
                className={`staff-app-scm-directory-filter${roleFilter === option.value ? " active" : ""}`}
              >
                {option.label}
              </Link>
            ))}
          </div>

          <p className="staff-app-scm-directory-note">
            The list below follows the same SCM role access scope as the platform and updates from the
            current SCM login.
          </p>

          <div className="staff-app-scm-list">
            {visibleScmStaff.length === 0 ? (
              <p className="staff-app-empty-state">
                No SCM staff profiles match this role inside your current access scope.
              </p>
            ) : (
              visibleScmStaff.map((candidate) => {
                const roleDefinition = getScmRoleDefinition(candidate.roleKey);
                const scopeSummary = getScmStaffScopeSummary(candidate);

                return (
                  <article key={candidate.id} className="staff-app-scm-person-card">
                    <div className="staff-app-scm-person-copy">
                      <strong>{candidate.displayName}</strong>
                      <p>{scopeSummary || roleDefinition.scopeLabel}</p>
                      <span>{candidate.email}</span>
                    </div>

                    <div className="staff-app-scm-person-badge-stack">
                      <span className={`staff-app-badge ${getRoleBadgeTone(candidate.roleKey)}`}>
                        {roleDefinition.label}
                      </span>
                      {candidate.id === profile.id ? (
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
