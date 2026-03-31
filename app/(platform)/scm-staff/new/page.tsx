import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { submitNewScmStaff } from "@/app/(platform)/scm-staff/new/actions";
import { requireScmStaffAdministrationProfile } from "@/lib/auth-session";
import { scmStaffManagedRoleOrder, getScmRoleDefinition } from "@/types/scm-rbac";

const countryOptions = ["Sweden", "Norway", "Denmark"] as const;

export default async function NewScmStaffPage() {
  await requireScmStaffAdministrationProfile();

  return (
    <>
      <PageHeader
        title="Create SCM Staff"
        subtitle="Add a new SCM Staff profile with role-based platform access. Temporary Gig Manager is shared from each gig."
        actions={
          <Link href="/scm-staff" className="button ghost">
            Back to SCM Staff
          </Link>
        }
      />

      <form action={submitNewScmStaff} className="content-grid">
        <div className="stack-column full-width-column">
          <section className="card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Basics</p>
                <h2>SCM Staff profile</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Display name</span>
                <input name="displayName" placeholder="Edwin Jones" required />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" placeholder="edwin.jones@scm.se" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input name="phone" placeholder="+46 70 123 45 67" />
              </label>
              <label className="field">
                <span>Role</span>
                <select name="roleKey" defaultValue="officeStaff" required>
                  {scmStaffManagedRoleOrder.map((roleKey) => (
                    <option key={roleKey} value={roleKey}>
                      {getScmRoleDefinition(roleKey).label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Country</span>
                <select name="country" defaultValue="Sweden">
                  {countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Regions</span>
                <textarea
                  name="regions"
                  rows={4}
                  placeholder={"Stockholm\nGothenburg"}
                />
              </label>
              <label className="field full-width">
                <span>Notes</span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Add internal notes about this SCM Staff profile."
                />
              </label>
            </div>
          </section>

          <section className="card footer-actions">
            <p className="muted">
              Saving creates the SCM Staff profile immediately. Temporary Gig Manager access is assigned from `Share gig info` on each gig.
            </p>
            <div className="page-actions">
              <button type="submit" className="button">
                Create SCM Staff
              </button>
            </div>
          </section>
        </div>
      </form>
    </>
  );
}
