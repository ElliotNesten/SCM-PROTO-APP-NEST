import {
  approveStaffApplication,
  rejectStaffApplication,
} from "@/app/(platform)/people/application-actions";
import { StaffApplicationAvatar } from "@/components/staff-application-avatar";
import { StatusBadge } from "@/components/status-badge";
import type { StoredStaffApplication } from "@/types/job-applications";

function getApplicationStatusTone(status: StoredStaffApplication["status"]) {
  if (status === "approved") {
    return "success" as const;
  }

  if (status === "rejected") {
    return "danger" as const;
  }

  return "warn" as const;
}

function getEmailStatusTone(status: StoredStaffApplication["approvalEmailStatus"]) {
  if (status === "sent") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  if (status === "pending") {
    return "warn" as const;
  }

  return "neutral" as const;
}

function getReviewMessage(reviewCode: string | undefined) {
  switch (reviewCode) {
    case "approved":
      return "Application approved and activation email sent.";
    case "approved-email-failed":
      return "Application approved, but the activation email could not be sent. Check Postmark configuration.";
    case "rejected":
      return "Application rejected.";
    case "email-resent":
      return "Activation email sent again.";
    case "duplicate-email":
      return "This applicant already exists as a staff profile.";
    case "already-reviewed":
      return "This application has already been reviewed.";
    case "already-activated":
      return "This employee account is already activated.";
    case "not-found":
      return "Application not found.";
    default:
      return "";
  }
}

export function StaffApplicationReviewPanel({
  applications,
  reviewCode,
}: {
  applications: StoredStaffApplication[];
  reviewCode?: string;
}) {
  const visibleApplications = applications.filter(
    (application) => application.status === "pending",
  );
  const reviewMessage = getReviewMessage(reviewCode);

  return (
    <section className="card staff-application-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Applications</p>
          <h2>Work at SCM</h2>
          <p className="page-subtitle">
            Review incoming applications, approve profiles, and trigger account activation.
          </p>
        </div>
        <span className="helper-caption">{visibleApplications.length} pending</span>
      </div>

      {reviewMessage ? <p className="system-settings-feedback">{reviewMessage}</p> : null}

      {visibleApplications.length === 0 ? (
        <div className="empty-panel">No pending job applications right now.</div>
      ) : (
        <div className="staff-application-list">
          {visibleApplications.map((application) => (
            <article key={application.id} className="staff-application-card">
              <div className="staff-application-card-main">
                <StaffApplicationAvatar
                  displayName={application.displayName}
                  imageUrl={application.profileImageUrl}
                />

                <div className="staff-application-copy">
                  <div className="staff-application-copy-head">
                    <div>
                      <strong>{application.displayName}</strong>
                      <p className="muted">
                        {application.region}, {application.country}
                      </p>
                    </div>
                    <div className="staff-application-status-row">
                      <StatusBadge
                        label={application.status}
                        tone={getApplicationStatusTone(application.status)}
                      />
                      <StatusBadge
                        label={`Email ${application.approvalEmailStatus}`}
                        tone={getEmailStatusTone(application.approvalEmailStatus)}
                      />
                    </div>
                  </div>

                  <div className="staff-application-meta-grid">
                    <div className="key-value-card">
                      <small>Email</small>
                      <strong>{application.email}</strong>
                    </div>
                    <div className="key-value-card">
                      <small>Phone</small>
                      <strong>{application.phone}</strong>
                    </div>
                    <div className="key-value-card">
                      <small>Submitted</small>
                      <strong>
                        {new Date(application.submittedAt).toLocaleString("sv-SE")}
                      </strong>
                    </div>
                    <div className="key-value-card">
                      <small>Reviewed by</small>
                      <strong>{application.reviewedByName ?? "Waiting for review"}</strong>
                    </div>
                  </div>

                  {application.approvalEmailError ? (
                    <p className="form-error">{application.approvalEmailError}</p>
                  ) : null}
                </div>
              </div>

              <div className="staff-application-actions">
                <form action={approveStaffApplication}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <button type="submit" className="button">
                    Godkann
                  </button>
                </form>
                <form action={rejectStaffApplication}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <button type="submit" className="button ghost">
                    Avsla
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
