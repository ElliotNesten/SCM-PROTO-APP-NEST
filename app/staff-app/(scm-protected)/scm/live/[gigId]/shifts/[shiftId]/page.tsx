import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileImage } from "@/components/profile-image";
import { formatStaffAppDate } from "@/lib/staff-app-data";
import { getStaffAppScmShiftWorkspace } from "@/lib/staff-app-scm-ops";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

import { assignScmGigStaffAction } from "../../../actions";

type StaffAppScmShiftPageProps = {
  params: Promise<{
    gigId: string;
    shiftId: string;
  }>;
};

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

function getPersonInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function StaffAppScmShiftPage({
  params,
}: StaffAppScmShiftPageProps) {
  const { gigId, shiftId } = await params;
  const profile = await requireCurrentStaffAppScmProfile();
  const workspace = await getStaffAppScmShiftWorkspace(profile, gigId, shiftId);

  if (!workspace) {
    notFound();
  }

  const livePath = `/staff-app/scm/live/${gigId}`;
  const shiftPath = `${livePath}/shifts/${shiftId}`;

  return (
    <section className="staff-app-screen staff-app-scm-screen staff-app-scm-live-screen">
      <div className="staff-app-card staff-app-scm-live-hero shift-detail">
        <div className="staff-app-scm-live-hero-copy">
          <p className="staff-app-kicker">Shift control</p>
          <h1>{workspace.shift.role}</h1>
          <p>
            {workspace.gig.artist} at {workspace.gig.arena}
          </p>
        </div>

        <div className="staff-app-scm-live-pill-row">
          <span className="staff-app-scm-live-pill">{formatStaffAppDate(workspace.gig.date)}</span>
          <span className="staff-app-scm-live-pill subtle">
            {workspace.shift.startTime} - {workspace.shift.endTime}
          </span>
          <span className="staff-app-scm-live-pill danger-soft">{workspace.shiftStatusLabel}</span>
        </div>

        <div className="staff-app-scm-live-inline-stats">
          <span>{workspace.confirmedCount}/{workspace.shift.requiredStaff} confirmed</span>
          <span>{workspace.gapCount} missing</span>
          <span>{workspace.lateCount} late</span>
          <span>{workspace.waitlistCount} waitlist</span>
        </div>

        <div className="staff-app-scm-live-action-grid">
          <Link href={livePath} className="staff-app-button secondary">
            Back to live view
          </Link>
        </div>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Pass roster</p>
            <h2>People on this pass</h2>
          </div>
        </div>

        <div className="staff-app-scm-live-roster staff-app-scm-live-roster-compact-grid">
          {workspace.roster.length === 0 ? (
            <p className="staff-app-empty-state">No staff are linked to this shift yet.</p>
          ) : (
            workspace.roster.map((entry) => (
              <article key={entry.id} className="staff-app-scm-live-roster-card compact">
                <div className="staff-app-scm-live-compact-person-head">
                  <div className="staff-app-scm-live-person-avatar compact">
                    <ProfileImage
                      displayName={entry.staffName}
                      imageUrl={entry.staffProfileImageUrl}
                      alt={entry.staffName}
                      className="staff-app-scm-live-person-avatar-image"
                      fallbackClassName="staff-app-scm-live-person-avatar-fallback"
                      fallbackText={getPersonInitials(entry.staffName)}
                    />
                  </div>

                  <span className={`staff-app-scm-status-pill ${getToneClassName(entry.tone)}`}>
                    {entry.statusLabel}
                  </span>
                </div>

                <div className="staff-app-scm-live-roster-copy compact">
                  <div className="staff-app-scm-live-compact-person-copy">
                    <strong>{entry.staffName}</strong>
                    <p>{entry.shiftRole}</p>
                  </div>

                  <div className="staff-app-scm-live-compact-person-contact">
                    {entry.staffPhone ? (
                      <a
                        href={`tel:${entry.staffPhone}`}
                        className="staff-app-scm-live-person-link"
                      >
                        {entry.staffPhone}
                      </a>
                    ) : entry.staffEmail ? (
                      <a
                        href={`mailto:${entry.staffEmail}`}
                        className="staff-app-scm-live-person-link"
                      >
                        {entry.staffEmail}
                      </a>
                    ) : (
                      <p>No contact info</p>
                    )}

                    {entry.staffPhone && entry.staffEmail ? (
                      <a
                        href={`mailto:${entry.staffEmail}`}
                        className="staff-app-scm-live-person-link secondary"
                      >
                        {entry.staffEmail}
                      </a>
                    ) : null}
                  </div>

                  <div className="staff-app-scm-live-inline-stats compact">
                    <span>
                      {entry.shiftStartTime} - {entry.shiftEndTime}
                    </span>
                    {entry.workedTimeLabel ? <span>{entry.workedTimeLabel}</span> : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Staffing adjustments</p>
            <h2>Add more people to this shift</h2>
          </div>
        </div>

        {workspace.availableStaff.length === 0 ? (
          <p className="staff-app-empty-state">
            No additional eligible staff are currently available for this pass.
          </p>
        ) : (
          <form action={assignScmGigStaffAction} className="staff-app-form-card">
            <input type="hidden" name="gigId" value={gigId} />
            <input type="hidden" name="shiftId" value={shiftId} />
            <input type="hidden" name="bookingStatus" value="Confirmed" />
            <input type="hidden" name="returnTo" value={shiftPath} />

            <label className="staff-app-form-field">
              <span>Available staff</span>
              <select name="staffId" defaultValue={workspace.availableStaff[0]?.id ?? ""}>
                {workspace.availableStaff.map((staffProfile) => (
                  <option key={staffProfile.id} value={staffProfile.id}>
                    {staffProfile.displayName} | {staffProfile.roleLabel} | {staffProfile.regionLabel}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="staff-app-button">
              Add staff as confirmed
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
