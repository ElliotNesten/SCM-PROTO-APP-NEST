import Link from "next/link";

import { updateStaffAppBankInfo } from "@/app/staff-app/actions";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppBankInfoPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getBankInfoStatusMessage(status: string | undefined) {
  if (status === "success") {
    return {
      tone: "success",
      text: "Bank information updated in both the Staff App and SCM platform.",
    };
  }

  if (status === "unavailable") {
    return {
      tone: "danger",
      text: "This staff account is not linked to a profile that can be updated.",
    };
  }

  return null;
}

function StaffAppProfileBackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m14.5 6.5-5 5 5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export default async function StaffAppBankInfoPage({
  searchParams,
}: StaffAppBankInfoPageProps) {
  const account = await requireCurrentStaffAppAccount();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const statusMessage = getBankInfoStatusMessage(
    pickQueryValue(resolvedSearchParams?.status),
  );
  const linkedProfile = account.linkedStaffProfileId
    ? await getStoredStaffProfileById(account.linkedStaffProfileId)
    : null;

  const bankName = linkedProfile?.bankName ?? "";
  const bankDetails = linkedProfile?.bankDetails ?? "";

  return (
    <section className="staff-app-screen staff-app-profile-subpage">
      <Link href="/staff-app/profile" className="staff-app-colleague-back" aria-label="Back">
        <StaffAppProfileBackIcon />
      </Link>

      <div className="staff-app-page-head">
        <p className="staff-app-kicker">Profile</p>
        <h1>Bank Info</h1>
        <p>Changes here sync directly back to your SCM staff profile.</p>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-detail-grid">
          <div className="staff-app-detail-cell">
            <span>Account holder</span>
            <strong>{account.firstName} {account.lastName}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Bank name</span>
            <strong>{bankName || "Not added"}</strong>
          </div>
          <div className="staff-app-detail-cell full">
            <span>Bank details</span>
            <strong>{bankDetails || "No bank account has been saved yet."}</strong>
          </div>
        </div>
      </div>

      <form action={updateStaffAppBankInfo} className="staff-app-card staff-app-form-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Edit</p>
            <h2>Update bank details</h2>
          </div>
        </div>

        {statusMessage ? (
          <p className={`staff-app-inline-alert ${statusMessage.tone}`}>{statusMessage.text}</p>
        ) : null}

        <label className="staff-app-form-field">
          <span>Bank name</span>
          <input name="bankName" type="text" defaultValue={bankName} placeholder="Bank name" />
        </label>

        <label className="staff-app-form-field">
          <span>Bank details</span>
          <input
            name="bankDetails"
            type="text"
            defaultValue={bankDetails}
            placeholder="Account number or payment details"
          />
        </label>

        <button type="submit" className="staff-app-button">
          Save bank info
        </button>
      </form>
    </section>
  );
}
