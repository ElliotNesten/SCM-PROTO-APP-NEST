import { logoutOfStaffApp } from "@/app/staff-app/actions";
import { getStaffAppScmData } from "@/lib/staff-app-scm-data";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

export default async function StaffAppScmProfilePage() {
  const profile = await requireCurrentStaffAppScmProfile();
  const scmData = await getStaffAppScmData(profile);

  return (
    <section className="staff-app-screen staff-app-scm-screen">
      <div className="staff-app-card staff-app-scm-hero profile">
        <div className="staff-app-scm-hero-copy">
          <p className="staff-app-kicker">SCM profile</p>
          <h1>{profile.displayName}</h1>
          <p>{scmData.roleDefinition.description}</p>
        </div>

        <div className="staff-app-scm-chip-row">
          <span className="staff-app-scm-chip">{scmData.roleDefinition.label}</span>
          <span className="staff-app-scm-chip subtle">{scmData.scopeLabel}</span>
        </div>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-detail-grid">
          <div className="staff-app-detail-cell">
            <span>Name</span>
            <strong>{profile.displayName}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Email</span>
            <strong>{profile.email}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Phone</span>
            <strong>{profile.phone}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Country</span>
            <strong>{profile.country}</strong>
          </div>
          <div className="staff-app-detail-cell full">
            <span>Regions</span>
            <strong>{profile.regions.length > 0 ? profile.regions.join(", ") : "Global scope"}</strong>
          </div>
          <div className="staff-app-detail-cell full">
            <span>Notes</span>
            <strong>{profile.notes || "No profile notes added."}</strong>
          </div>
        </div>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Access</p>
            <h2>Permissions</h2>
          </div>
        </div>

        <div className="staff-app-scm-line-list">
          {scmData.roleDefinition.permissions.map((permission) => (
            <div key={permission} className="staff-app-scm-line-item">
              {permission}
            </div>
          ))}
        </div>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Boundaries</p>
            <h2>Restrictions</h2>
          </div>
        </div>

        <div className="staff-app-scm-line-list">
          {scmData.roleDefinition.restrictions.length === 0 ? (
            <div className="staff-app-scm-line-item">No extra restrictions are configured for this role.</div>
          ) : (
            scmData.roleDefinition.restrictions.map((restriction) => (
              <div key={restriction} className="staff-app-scm-line-item muted">
                {restriction}
              </div>
            ))
          )}
        </div>
      </div>

      <form action={logoutOfStaffApp} className="staff-app-card staff-app-form-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Session</p>
            <h2>Log out of Staff App</h2>
          </div>
        </div>
        <p className="staff-app-muted">
          This logs you out of the role-based SCM Staff mobile interface.
        </p>
        <button type="submit" className="staff-app-button secondary">
          Log out
        </button>
      </form>
    </section>
  );
}
