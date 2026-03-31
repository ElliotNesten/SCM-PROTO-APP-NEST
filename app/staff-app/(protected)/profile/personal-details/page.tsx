import Link from "next/link";

import { updateStaffAppPersonalDetails } from "@/app/staff-app/actions";
import { getStoredStaffProfileById } from "@/lib/staff-store";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppPersonalDetailsPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

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

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPersonalDetailsStatusMessage(status: string | undefined) {
  if (status === "success") {
    return {
      tone: "success",
      text: "Personal details updated in both the Staff App and SCM platform.",
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

export default async function StaffAppPersonalDetailsPage({
  searchParams,
}: StaffAppPersonalDetailsPageProps) {
  const account = await requireCurrentStaffAppAccount();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const statusMessage = getPersonalDetailsStatusMessage(
    pickQueryValue(resolvedSearchParams?.status),
  );
  const linkedProfile = account.linkedStaffProfileId
    ? await getStoredStaffProfileById(account.linkedStaffProfileId)
    : null;

  const personalNumber = linkedProfile?.personalNumber ?? "";
  const allergies = linkedProfile?.allergies ?? "";
  const driverLicenseManual = linkedProfile?.driverLicenseManual ?? false;
  const driverLicenseAutomatic = linkedProfile?.driverLicenseAutomatic ?? false;

  return (
    <section className="staff-app-screen staff-app-profile-subpage">
      <Link href="/staff-app/profile" className="staff-app-colleague-back" aria-label="Back">
        <StaffAppProfileBackIcon />
      </Link>

      <div className="staff-app-page-head">
        <p className="staff-app-kicker">Profile</p>
        <h1>Personuppgifter</h1>
        <p>Changes here sync directly back to your SCM staff profile.</p>
      </div>

      <form action={updateStaffAppPersonalDetails} className="staff-app-card staff-app-form-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Edit</p>
            <h2>Update personal details</h2>
          </div>
        </div>

        {statusMessage ? (
          <p className={`staff-app-inline-alert ${statusMessage.tone}`}>{statusMessage.text}</p>
        ) : null}

        <label className="staff-app-form-field">
          <span>Personal number</span>
          <input
            name="personalNumber"
            type="text"
            defaultValue={personalNumber}
            placeholder="Personal number"
          />
        </label>

        <div className="staff-app-form-field">
          <span>Driver licence</span>
          <div className="staff-app-checkbox-grid">
            <label className="staff-app-checkbox">
              <input
                name="driverLicenseManual"
                type="checkbox"
                defaultChecked={driverLicenseManual}
              />
              <span>Manual driver license</span>
            </label>
            <label className="staff-app-checkbox">
              <input
                name="driverLicenseAutomatic"
                type="checkbox"
                defaultChecked={driverLicenseAutomatic}
              />
              <span>Automatic driver license</span>
            </label>
          </div>
        </div>

        <label className="staff-app-form-field">
          <span>Allergies</span>
          <textarea
            name="allergies"
            rows={4}
            defaultValue={allergies}
            placeholder="Add allergies or practical health notes"
          />
        </label>

        <button type="submit" className="staff-app-button">
          Save personal details
        </button>
      </form>
    </section>
  );
}
