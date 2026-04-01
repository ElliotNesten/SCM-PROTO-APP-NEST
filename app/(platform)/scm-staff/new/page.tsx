import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { submitNewScmStaff } from "@/app/(platform)/scm-staff/new/actions";
import { requireScmStaffAdministrationProfile } from "@/lib/auth-session";
import { scmStaffManagedRoleOrder, getScmRoleDefinition } from "@/types/scm-rbac";

const countryOptions = ["Sweden", "Norway", "Denmark"] as const;

type NewScmStaffPageProps = {
  searchParams?: Promise<{
    create?: string | string[];
  }>;
};

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCreateStatusMessage(status: string | undefined) {
  if (status === "missing-email") {
    return "Email is required to send the SCM Staff activation link.";
  }

  if (status === "duplicate-email") {
    return "An SCM Staff profile with this email already exists.";
  }

  return "";
}

export default async function NewScmStaffPage({ searchParams }: NewScmStaffPageProps) {
  await requireScmStaffAdministrationProfile();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const createStatusMessage = getCreateStatusMessage(
    pickQueryValue(resolvedSearchParams?.create),
  );

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

      {createStatusMessage ? <p className="login-error">{createStatusMessage}</p> : null}

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
                <input
                  name="email"
                  type="email"
                  placeholder="edwin.jones@scm.se"
                  required
                />
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
              Saving creates the SCM Staff profile immediately and sends an activation
              email from the SCM no-reply mail flow so the new SCM Staff user can create
              their own password. Temporary Gig Manager access is assigned from `Share gig
              info` on each gig.
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
