import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { submitNewStaff } from "@/app/(platform)/people/new/actions";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { canAccessPlatformStaffDirectory } from "@/lib/platform-access";

const countryOptions = ["Sweden", "Norway", "Denmark"] as const;
const availabilityOptions = ["Available", "Limited", "Busy"] as const;
const approvalOptions = ["Approved", "Applicant", "Archived"] as const;
const registrationOptions = [
  "APPROVED",
  "PENDING",
  "ACTIVATED",
  "REJECTED",
  "BLOCKED",
  "DEACTIVATED",
] as const;

export default async function NewStaffPage() {
  const currentProfile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!canAccessPlatformStaffDirectory(currentProfile.roleKey)) {
    redirect("/dashboard");
  }

  return (
    <>
      <PageHeader
        title="Create Staff"
        subtitle="Add a new employee profile to the staff registry."
        actions={
          <Link href="/people" className="button ghost">
            Back to staff
          </Link>
        }
      />

      <form action={submitNewStaff} className="content-grid">
        <div className="stack-column full-width-column">
          <section className="card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Basics</p>
                <h2>Employee profile</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>First name</span>
                <input name="firstName" placeholder="Sandra" required />
              </label>
              <label className="field">
                <span>Last name</span>
                <input name="lastName" placeholder="Munoz" required />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" placeholder="sandra@scm.se" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input name="phone" placeholder="+46 70 111 1111" />
              </label>
              <label className="field">
                <span>Access role</span>
                <input name="accessRoleLabel" defaultValue="Field staff" />
              </label>
              <label className="field">
                <span>Country</span>
                <select name="country" defaultValue="Sweden" required>
                  {countryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Region / City</span>
                <input name="region" placeholder="Stockholm" required />
              </label>
              <label className="field">
                <span>Role scope</span>
                <input name="roles" placeholder="Stand Leader, Seller" />
              </label>
              <label className="field">
                <span>Availability</span>
                <select name="availability" defaultValue="Available">
                  {availabilityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Approval status</span>
                <select name="approvalStatus" defaultValue="Approved">
                  {approvalOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Registration</span>
                <select name="registrationStatus" defaultValue="APPROVED">
                  {registrationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Profile approval</span>
                <select name="profileApproved" defaultValue="approved">
                  <option value="approved">Approved</option>
                  <option value="pending">Pending review</option>
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <input name="priority" type="number" min="1" max="5" defaultValue="1" />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Records</p>
                <h2>Profile details</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Bank details</span>
                <input name="bankDetails" placeholder="8234 | **** 1001" />
              </label>
              <label className="field">
                <span>Personal number</span>
                <input name="personalNumber" placeholder="********-1101" />
              </label>
              <label className="field full-width">
                <span>Profile comments</span>
                <textarea
                  name="profileComments"
                  rows={4}
                  placeholder="Add internal profile comments."
                />
              </label>
              <label className="field full-width">
                <span>Pending records</span>
                <textarea
                  name="pendingRecords"
                  rows={5}
                  placeholder={"Driver license\nAllergies\nPolicy confirmations"}
                />
              </label>
            </div>
          </section>

          <section className="card footer-actions">
            <p className="muted">
              Saving now creates the employee profile in the staff registry immediately.
            </p>
            <div className="page-actions">
              <button type="submit" className="button">
                Create staff
              </button>
            </div>
          </section>
        </div>
      </form>
    </>
  );
}
