import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ScmStaffProfileEditor } from "@/components/scm-staff-profile-editor";
import {
  canAccessScmStaffAdministration,
  isSuperAdminRole,
  requireCurrentAuthenticatedScmStaffProfile,
} from "@/lib/auth-session";
import { getAllStoredGigs } from "@/lib/gig-store";
import { redactScmStaffPasswordPlaintext } from "@/lib/scm-staff-store";
import { filterPlatformGigsForProfile, isTemporaryGigManagerProfile } from "@/lib/platform-access";

export default async function ProfilePage() {
  noStore();
  const currentScmStaffProfile = await requireCurrentAuthenticatedScmStaffProfile();

  if (isTemporaryGigManagerProfile(currentScmStaffProfile)) {
    const accessibleGigs = filterPlatformGigsForProfile(
      await getAllStoredGigs(),
      currentScmStaffProfile,
    );

    return (
      <>
        <PageHeader
          title={currentScmStaffProfile.displayName}
          subtitle="Temporary Gig Manager access"
          actions={
            <Link href="/dashboard" className="button ghost">
              Back to dashboard
            </Link>
          }
        />

        <section className="content-grid">
          <div className="stack-column">
            <div className="card">
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">Access</p>
                  <h3>Platform login summary</h3>
                </div>
              </div>

              <div className="list-stack">
                <div className="key-value-card">
                  <small>Name</small>
                  <strong>{currentScmStaffProfile.displayName}</strong>
                </div>
                <div className="key-value-card">
                  <small>Email</small>
                  <strong>{currentScmStaffProfile.email}</strong>
                </div>
                <div className="key-value-card">
                  <small>Role</small>
                  <strong>Temporary Gig Manager</strong>
                </div>
                <div className="key-value-card">
                  <small>Scope</small>
                  <p className="muted">
                    Access is limited to the shared gig, its related workflows, and no other
                    platform administration areas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="stack-column">
            <div className="card">
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">Gigs</p>
                  <h3>Active platform scope</h3>
                </div>
              </div>

              {accessibleGigs.length === 0 ? (
                <div className="empty-panel">
                  No active gig access is available right now.
                </div>
              ) : (
                <div className="list-stack">
                  {accessibleGigs.map((gig) => (
                    <Link key={gig.id} href={`/gigs/${gig.id}`} className="key-value-card">
                      <strong>{gig.artist}</strong>
                      <p className="muted">
                        {gig.arena}, {gig.city}, {gig.country} | {gig.date}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </>
    );
  }

  const canRevealStoredPassword = isSuperAdminRole(currentScmStaffProfile.roleKey);
  const editableProfile = canRevealStoredPassword
    ? currentScmStaffProfile
    : redactScmStaffPasswordPlaintext(currentScmStaffProfile);

  return (
    <>
      <ScmStaffProfileEditor
        initialProfile={editableProfile}
        backHref="/dashboard"
        backLabel="Back to dashboard"
        canManageAdministrativeFields={canAccessScmStaffAdministration(
          currentScmStaffProfile.roleKey,
        )}
        canEditProfileImage
        canEditRole={isSuperAdminRole(currentScmStaffProfile.roleKey)}
        canChangePassword
        canRevealStoredPassword={canRevealStoredPassword}
        requiresCurrentPassword={!canRevealStoredPassword}
      />
    </>
  );
}
