import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ProfileImage } from "@/components/profile-image";
import { ScmRolePermissionGuide } from "@/components/scm-role-permission-guide";
import { StatusBadge } from "@/components/status-badge";
import { getAllStoredGigs } from "@/lib/gig-store";
import {
  canAccessScmStaffDirectory,
  canAccessScmStaffAdministration,
  isSuperAdminRole,
  requireScmStaffDirectoryProfile,
} from "@/lib/auth-session";
import {
  canAccessPlatformStaffDirectory,
  canCreatePlatformGigs,
  canManageGigShare,
  canUsePlatformGlobalSearch,
} from "@/lib/platform-access";
import {
  getAllStoredScmStaffProfiles,
  getScmStaffScopeSummary,
} from "@/lib/scm-staff-store";
import { getAllStoredStaffProfiles } from "@/lib/staff-store";
import {
  getScmRoleDefinition,
  scmStaffRoleOrder,
  type ScmStaffRoleKey,
  type StoredScmStaffProfile,
} from "@/types/scm-rbac";

type DirectoryProfile = StoredScmStaffProfile & {
  href?: string;
  isDerivedTemporaryGigManager?: boolean;
};

type DerivedTemporaryGigManagerProfile = DirectoryProfile & {
  roleKey: "temporaryGigManager";
  linkedStaffId: string;
  linkedStaffName: string;
  href: string;
  isDerivedTemporaryGigManager: true;
};

type ScmPermissionChecklistItem = {
  label: string;
  allowed: boolean;
};

function getDisplayInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getRoleBadgeTone(roleKey: ScmStaffRoleKey) {
  if (roleKey === "superAdmin") {
    return "warn" as const;
  }

  if (roleKey === "regionalManager") {
    return "success" as const;
  }

  if (roleKey === "temporaryGigManager") {
    return "info" as const;
  }

  return "neutral" as const;
}

function getScmStaffScopeLine(profile: {
  roleKey: ScmStaffRoleKey;
  country: string;
  regions: string[];
  assignedGigIds: string[];
}) {
  if (profile.roleKey === "regionalManager") {
    return getScmStaffScopeSummary(profile);
  }

  if (profile.roleKey === "temporaryGigManager" && profile.assignedGigIds.length > 0) {
    return `Assigned gigs: ${profile.assignedGigIds.length}`;
  }

  return "";
}

function getTemporaryGigManagerLinkedGigLine(
  profile: {
    roleKey: ScmStaffRoleKey;
    assignedGigIds: string[];
  },
  gigNameById: Map<string, string>,
) {
  if (profile.roleKey !== "temporaryGigManager" || profile.assignedGigIds.length === 0) {
    return "";
  }

  const linkedGigNames = profile.assignedGigIds
    .map((gigId) => gigNameById.get(gigId))
    .filter((gigName): gigName is string => Boolean(gigName));

  if (linkedGigNames.length === 0) {
    return "";
  }

  return `Linked GIGs: ${linkedGigNames.join(", ")}`;
}

function buildDerivedTemporaryGigManagerProfiles(
  storedProfiles: StoredScmStaffProfile[],
  storedGigs: Awaited<ReturnType<typeof getAllStoredGigs>>,
  staffProfiles: Awaited<ReturnType<typeof getAllStoredStaffProfiles>>,
) {
  const staffIdsWithStoredTemporaryAccess = new Set(
    storedProfiles
      .filter((profile) => profile.roleKey === "temporaryGigManager")
      .flatMap((profile) =>
        [profile.linkedStaffId?.trim(), profile.email.trim().toLowerCase()].filter(Boolean),
      ),
  );
  const gigIdsByStaffProfileId = new Map<string, Set<string>>();

  storedGigs.forEach((gig) => {
    (gig.temporaryGigManagers ?? []).forEach((assignment) => {
      const staffProfileId = assignment.staffProfileId.trim();

      if (!staffProfileId) {
        return;
      }

      const currentGigIds = gigIdsByStaffProfileId.get(staffProfileId) ?? new Set<string>();
      currentGigIds.add(gig.id);
      gigIdsByStaffProfileId.set(staffProfileId, currentGigIds);
    });
  });

  const derivedProfiles: DerivedTemporaryGigManagerProfile[] = [];

  Array.from(gigIdsByStaffProfileId.entries()).forEach(([staffProfileId, gigIds]) => {
    const staffProfile = staffProfiles.find((profile) => profile.id === staffProfileId);

    if (!staffProfile) {
      return;
    }

    if (
      staffIdsWithStoredTemporaryAccess.has(staffProfile.id) ||
      staffIdsWithStoredTemporaryAccess.has(staffProfile.email.toLowerCase())
    ) {
      return;
    }

    derivedProfiles.push({
      id: `derived-temp-${staffProfile.id}`,
      displayName: staffProfile.displayName,
      email: staffProfile.email,
      passwordHash: "",
      phone: staffProfile.phone,
      roleKey: "temporaryGigManager",
      country: staffProfile.country,
      regions: staffProfile.regions ?? [staffProfile.region].filter(Boolean),
      assignedGigIds: Array.from(gigIds),
      linkedStaffId: staffProfile.id,
      linkedStaffName: staffProfile.displayName,
      profileImageName: staffProfile.profileImageName,
      profileImageUrl: staffProfile.profileImageUrl,
      notes: "Derived from Share gig info access.",
      href: `/people/${staffProfile.id}`,
      isDerivedTemporaryGigManager: true,
    });
  });

  return derivedProfiles;
}

function getDirectoryRoleStats(profiles: DirectoryProfile[]) {
  return {
    total: profiles.length,
    superAdmin: profiles.filter((profile) => profile.roleKey === "superAdmin").length,
    officeStaff: profiles.filter((profile) => profile.roleKey === "officeStaff").length,
    regionalManager: profiles.filter((profile) => profile.roleKey === "regionalManager").length,
    temporaryGigManager: profiles.filter(
      (profile) => profile.roleKey === "temporaryGigManager",
    ).length,
  };
}

function getRolePermissionChecklist(roleKey: ScmStaffRoleKey): ScmPermissionChecklistItem[] {
  const canOpenScmStaffDirectory = canAccessScmStaffDirectory(roleKey);
  const canManageScmStaffProfiles = canAccessScmStaffAdministration(roleKey);
  const canOpenStaffDirectory = canAccessPlatformStaffDirectory(roleKey);
  const canCreateAndEditGigs = canCreatePlatformGigs(roleKey);
  const canShareGigInfo = canManageGigShare(roleKey);
  const canUseGlobalSearch = canUsePlatformGlobalSearch(roleKey);
  const canAccessPayrollAndReports =
    roleKey === "superAdmin" || roleKey === "officeStaff" || roleKey === "regionalManager";
  const canManageSystemSettings = isSuperAdminRole(roleKey);

  return [
    { label: "Open SCM Staff directory", allowed: canOpenScmStaffDirectory },
    { label: "Create and manage SCM Staff profiles", allowed: canManageScmStaffProfiles },
    { label: "Access Staff directory", allowed: canOpenStaffDirectory },
    { label: "Create and edit gigs", allowed: canCreateAndEditGigs },
    { label: "Share gig info and invite Temp GMs", allowed: canShareGigInfo },
    { label: "Use platform global search", allowed: canUseGlobalSearch },
    { label: "Access payroll and reports", allowed: canAccessPayrollAndReports },
    { label: "Manage system settings and policy PDFs", allowed: canManageSystemSettings },
  ];
}

export default async function ScmStaffPage() {
  noStore();
  const currentProfile = await requireScmStaffDirectoryProfile();
  const canManageScmStaffProfiles = canAccessScmStaffAdministration(currentProfile.roleKey);
  const [profiles, storedGigs, staffProfiles] = await Promise.all([
    getAllStoredScmStaffProfiles(),
    getAllStoredGigs(),
    getAllStoredStaffProfiles(),
  ]);
  const derivedTemporaryGigManagers = buildDerivedTemporaryGigManagerProfiles(
    profiles,
    storedGigs,
    staffProfiles,
  );
  const storedDirectoryProfiles: DirectoryProfile[] = profiles.map((profile) => ({
    ...profile,
    href: `/scm-staff/${profile.id}`,
  }));
  const directoryProfiles: DirectoryProfile[] = [
    ...storedDirectoryProfiles,
    ...derivedTemporaryGigManagers,
  ];
  const stats = getDirectoryRoleStats(directoryProfiles);
  const gigNameById = new Map(storedGigs.map((gig) => [gig.id, gig.artist]));

  return (
    <>
      <PageHeader
        title="SCM Staff"
        subtitle="Role-based access and admin scope for the platform."
        actions={
          canManageScmStaffProfiles ? (
            <div className="page-actions">
              <Link href="/scm-staff/new" className="button">
                New SCM Staff
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="scm-staff-top-grid">
        <section className="card staff-top-stats-card scm-staff-rbac-card">
          <div className="staff-top-stats-grid scm-staff-rbac-grid">
            <div className="staff-top-stat-card scm-staff-rbac-stat">
              <small>Super Admin</small>
              <strong>{stats.superAdmin}</strong>
            </div>
            <div className="staff-top-stat-card scm-staff-rbac-stat">
              <small>Office Staff</small>
              <strong>{stats.officeStaff}</strong>
            </div>
            <div className="staff-top-stat-card scm-staff-rbac-stat">
              <small>Regional Manager</small>
              <strong>{stats.regionalManager}</strong>
            </div>
            <div className="staff-top-stat-card scm-staff-rbac-stat">
              <small>Temporary Gig Manager</small>
              <strong>{stats.temporaryGigManager}</strong>
            </div>
          </div>
        </section>

        <aside className="card scm-staff-role-guide-card">
          <div className="section-head compact">
            <div>
              <p className="eyebrow">Role guide</p>
              <h3>Permission checklist</h3>
            </div>
            <span className="helper-caption">{scmStaffRoleOrder.length} roles</span>
          </div>

          <p className="muted scm-staff-role-guide-copy">
            Review what each SCM platform role can open and manage.
          </p>

          <ScmRolePermissionGuide
            roles={scmStaffRoleOrder.map((roleKey) => {
              const roleDefinition = getScmRoleDefinition(roleKey);

              return {
                key: roleKey,
                label: roleDefinition.label,
                scopeLabel: roleDefinition.scopeLabel,
                description: roleDefinition.description,
                permissions: getRolePermissionChecklist(roleKey),
              };
            })}
          />
        </aside>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>SCM Staff access</h2>
          </div>
          <span className="helper-caption">{directoryProfiles.length} records</span>
        </div>

        {directoryProfiles.length === 0 ? (
          <div className="empty-panel">No SCM staff profiles available yet.</div>
        ) : (
          <div className="staff-list-grid">
            {directoryProfiles.map((profile) => {
              const roleDefinition = getScmRoleDefinition(profile.roleKey);
              const scopeLine = getScmStaffScopeLine(profile);
              const linkedGigLine = getTemporaryGigManagerLinkedGigLine(profile, gigNameById);
              const cardContent = (
                <>
                  <div className="staff-list-avatar" aria-hidden="true">
                    <ProfileImage
                      displayName={profile.displayName}
                      imageUrl={profile.profileImageUrl}
                      alt={`${profile.displayName} profile`}
                      className="staff-list-avatar-img"
                      fallbackText={getDisplayInitials(profile.displayName)}
                    />
                  </div>

                  <div className="staff-grid-card-body scm-staff-card-body">
                    <div className="staff-list-name-row">
                      <strong>{profile.displayName}</strong>
                    </div>
                    <div className="scm-staff-card-role-row">
                      <StatusBadge
                        label={roleDefinition.label}
                        tone={getRoleBadgeTone(profile.roleKey)}
                      />
                    </div>
                    {scopeLine ? (
                      <p className="muted small-text scm-staff-card-note" title={scopeLine}>
                        {scopeLine}
                      </p>
                    ) : null}
                    {linkedGigLine ? (
                      <p className="muted small-text scm-staff-card-note" title={linkedGigLine}>
                        {linkedGigLine}
                      </p>
                    ) : null}
                  </div>
                </>
              );

              if (profile.href) {
                return (
                  <Link
                    key={profile.id}
                    href={profile.href}
                    className="staff-grid-card scm-staff-card"
                  >
                    {cardContent}
                  </Link>
                );
              }

              return (
                <div key={profile.id} className="staff-grid-card scm-staff-card">
                  {cardContent}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
