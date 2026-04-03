import Link from "next/link";

import { changeStaffAppPassword, logoutOfStaffApp } from "@/app/staff-app/actions";
import { formatStaffAppApprovedRolesLabel } from "@/lib/staff-app-scope";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppProfilePageProps = {
  searchParams?: Promise<{
    password?: string | string[];
  }>;
};

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPasswordStatusMessage(status: string | undefined) {
  if (status === "success") {
    return {
      tone: "success",
      text: "Password updated successfully.",
    };
  }

  if (status === "missing") {
    return {
      tone: "danger",
      text: "Fill in your current password, new password, and confirmation.",
    };
  }

  if (status === "invalid") {
    return {
      tone: "danger",
      text: "The current password does not match your account.",
    };
  }

  if (status === "length") {
    return {
      tone: "danger",
      text: "Choose a new password with at least 6 characters.",
    };
  }

  if (status === "mismatch") {
    return {
      tone: "danger",
      text: "The new password and confirmation do not match.",
    };
  }

  return null;
}

function StaffAppDisclosureChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export default async function StaffAppProfilePage({
  searchParams,
}: StaffAppProfilePageProps) {
  const account = await requireCurrentStaffAppAccount();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const passwordStatus = getPasswordStatusMessage(
    pickQueryValue(resolvedSearchParams?.password),
  );

  return (
    <section className="staff-app-screen">
      <div className="staff-app-card emphasis">
        <p className="staff-app-kicker">Profile</p>
        <h1>{account.firstName} {account.lastName}</h1>
        <p className="staff-app-muted">
          {account.country} · {account.region}
        </p>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-detail-grid">
          <div className="staff-app-detail-cell">
            <span>Name</span>
            <strong>{account.firstName} {account.lastName}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Phone</span>
            <strong>{account.phone}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Email</span>
            <strong>{account.email}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Country</span>
            <strong>{account.country}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Region</span>
            <strong>{account.region}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Approved roles</span>
            <strong>{formatStaffAppApprovedRolesLabel(account.roleScopes)}</strong>
          </div>
        </div>
      </div>

      <div className="staff-app-profile-action-grid">
        <Link href="/staff-app/profile/bank-info" className="staff-app-profile-action-card">
          <strong>Bank Info</strong>
          <span>View your saved bank account and payment details</span>
        </Link>
        <Link
          href="/staff-app/profile/personal-details"
          className="staff-app-profile-action-card"
        >
          <strong>Personuppgifter</strong>
          <span>Review personal details, licences, and profile data</span>
        </Link>
      </div>

      <form action={changeStaffAppPassword} className="staff-app-card staff-app-form-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Password</p>
            <h2>Change sign-in password</h2>
          </div>
        </div>

        <details className="staff-app-disclosure" open={Boolean(passwordStatus)}>
          <summary className="staff-app-disclosure-toggle">
            <span>Open password form</span>
            <span className="staff-app-disclosure-icon" aria-hidden="true">
              <StaffAppDisclosureChevron />
            </span>
          </summary>

          <div className="staff-app-disclosure-panel">
            {passwordStatus ? (
              <p className={`staff-app-inline-alert ${passwordStatus.tone}`}>
                {passwordStatus.text}
              </p>
            ) : null}

            <label className="staff-app-form-field">
              <span>Current password</span>
              <input name="currentPassword" type="password" placeholder="Current password" />
            </label>
            <label className="staff-app-form-field">
              <span>New password</span>
              <input name="nextPassword" type="password" placeholder="Minimum 6 characters" />
            </label>
            <label className="staff-app-form-field">
              <span>Confirm new password</span>
              <input name="confirmPassword" type="password" placeholder="Repeat new password" />
            </label>

            <button type="submit" className="staff-app-button">
              Save new password
            </button>
          </div>
        </details>
      </form>

      <form action={logoutOfStaffApp} className="staff-app-card staff-app-form-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Session</p>
            <h2>Log out of the mobile app</h2>
          </div>
        </div>
        <p className="staff-app-muted">
          This signs you out of the standalone staff app without affecting the admin platform.
        </p>
        <button type="submit" className="staff-app-button secondary">
          Log out
        </button>
      </form>
    </section>
  );
}
