import { redirect } from "next/navigation";

import {
  finishStaffAppOnboarding,
  submitStaffAppOnboarding,
} from "@/app/staff-app/actions";
import { getStaffOnboardingRecordByAccountId } from "@/lib/staff-onboarding-store";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppOnboardingPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

function pickValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getStatusMessage(status: string | undefined) {
  if (status === "missing") {
    return "Enter your personal identity number, bank, and bank account before continuing.";
  }

  if (status === "unavailable") {
    return "We could not connect onboarding to your staff profile.";
  }

  return "";
}

export default async function StaffAppOnboardingPage({
  searchParams,
}: StaffAppOnboardingPageProps) {
  const account = await requireCurrentStaffAppAccount();

  if (!account.mustCompleteOnboarding) {
    redirect("/staff-app/home");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const statusMessage = getStatusMessage(pickValue(resolvedSearchParams?.status));
  const onboardingRecord = await getStaffOnboardingRecordByAccountId(account.id);
  const isReadyForWelcome = Boolean(onboardingRecord && !onboardingRecord.welcomeAcknowledgedAt);
  const readyRecord = isReadyForWelcome ? onboardingRecord : null;

  return (
    <div className="staff-app-shell login">
      <div className="staff-app-device login">
        <section className="staff-app-login-screen">
          <div className="staff-app-create-password-card staff-app-onboarding-card">
            <div className="staff-app-create-password-copy">
              <p className="staff-app-kicker">First login</p>
              <h1>Onboarding</h1>
              <p>Before you can use the app, we need your personal details and payroll information.</p>
            </div>

            {statusMessage ? (
              <p className="staff-app-inline-alert danger">{statusMessage}</p>
            ) : null}

            {isReadyForWelcome ? (
              <div className="staff-app-onboarding-ready">
                <div className="staff-app-inline-alert success">
                  Your onboarding details have been saved. Continue to open the app.
                </div>

                <div className="staff-app-detail-grid">
                  {readyRecord ? (
                    <>
                      <div className="staff-app-detail-cell">
                        <span>Personal identity number</span>
                        <strong>{readyRecord.personalNumber}</strong>
                      </div>
                      <div className="staff-app-detail-cell">
                        <span>Bank</span>
                        <strong>{readyRecord.bankName}</strong>
                      </div>
                      <div className="staff-app-detail-cell full">
                        <span>Bank account</span>
                        <strong>{readyRecord.bankAccount}</strong>
                      </div>
                    </>
                  ) : null}
                </div>

                <form action={finishStaffAppOnboarding}>
                  <button type="submit" className="staff-app-button">
                    Welcome to SCM
                  </button>
                </form>
              </div>
            ) : (
              <form action={submitStaffAppOnboarding} className="staff-app-create-password-form">
                <label className="staff-app-form-field">
                  <span>Personal identity number</span>
                  <input
                    name="personalNumber"
                    defaultValue={onboardingRecord?.personalNumber ?? ""}
                    required
                  />
                </label>

                <label className="staff-app-form-field">
                  <span>Bank</span>
                  <input
                    name="bankName"
                    defaultValue={onboardingRecord?.bankName ?? ""}
                    required
                  />
                </label>

                <label className="staff-app-form-field">
                  <span>Bank account</span>
                  <input
                    name="bankAccount"
                    defaultValue={onboardingRecord?.bankAccount ?? ""}
                    required
                  />
                </label>

                <label className="staff-app-form-field">
                  <span>Any allergies (optional)</span>
                  <textarea
                    name="allergies"
                    rows={3}
                    defaultValue={onboardingRecord?.allergies ?? ""}
                  />
                </label>

                <div className="staff-app-checkbox-grid">
                  <label className="staff-app-checkbox">
                    <input
                      name="driverLicenseManual"
                      type="checkbox"
                      defaultChecked={onboardingRecord?.driverLicenseManual ?? false}
                    />
                    <span>Driver's license (manual)</span>
                  </label>
                  <label className="staff-app-checkbox">
                    <input
                      name="driverLicenseAutomatic"
                      type="checkbox"
                      defaultChecked={onboardingRecord?.driverLicenseAutomatic ?? false}
                    />
                    <span>Driver's license (automatic)</span>
                  </label>
                </div>

                <button type="submit" className="staff-app-button">
                  Save onboarding
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
