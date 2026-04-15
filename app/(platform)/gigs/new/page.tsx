import Link from "next/link";
import { redirect } from "next/navigation";

import { GigDocumentBoxes } from "@/components/gig-document-boxes";
import { GigLocationFields } from "@/components/gig-location-fields";
import { PageHeader } from "@/components/page-header";
import { EquipmentSection } from "@/components/equipment-section";
import { NotesPlanningSection } from "@/components/notes-planning-section";
import { MerchCompanyAutocompleteField } from "@/components/merch-company-autocomplete-field";
import { PromoterAutocompleteField } from "@/components/promoter-autocomplete-field";
import { ScmRepresentativeSelector } from "@/components/scm-representative-selector";
import { getProjectManagerOptions } from "@/data/backend-user-data";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getStoredGigById } from "@/lib/gig-store";
import { canCreatePlatformGigs } from "@/lib/platform-access";
import { buildScmStaffRepresentativeOptions, buildTemporaryGigManagerOptions } from "@/lib/scm-representative-options";
import { getAllStoredScmStaffProfiles } from "@/lib/scm-staff-store";
import { getAllStoredStaffProfiles } from "@/lib/staff-store";
import { getSystemScmInfoSettings } from "@/lib/system-scm-info-store";
import {
  saveProjectManagerStep,
  submitNewGig,
} from "@/app/(platform)/gigs/new/actions";

type NewGigPageProps = {
  searchParams?: Promise<{
    projectManagerGigId?: string | string[];
  }>;
};

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewGigPage({ searchParams }: NewGigPageProps) {
  const currentProfile = await requireCurrentAuthenticatedScmStaffProfile();

  if (!canCreatePlatformGigs(currentProfile.roleKey)) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const projectManagerGigId = pickQueryValue(resolvedSearchParams?.projectManagerGigId);
  const [createdGig, scmStaffProfiles, staffProfiles, scmInfoSettings] = await Promise.all([
    projectManagerGigId ? getStoredGigById(projectManagerGigId) : Promise.resolve(undefined),
    getAllStoredScmStaffProfiles(),
    getAllStoredStaffProfiles(),
    getSystemScmInfoSettings(),
  ]);
  const projectManagerOptions = getProjectManagerOptions();
  const scmRepresentativeOptions = buildScmStaffRepresentativeOptions(scmStaffProfiles);
  const temporaryGigManagerOptions = buildTemporaryGigManagerOptions(staffProfiles);

  return (
    <>
      <PageHeader
        title="New Gig"
        subtitle="Fill in the basics to create a new gig. You can add files and more details after saving."
        actions={
          <Link href="/gigs" className="button ghost">
            Back to gigs
          </Link>
        }
      />

      <form action={submitNewGig} className="stack-column create-gig-form">
        <div className="create-gig-primary-grid">
          <section className="card create-gig-primary-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Basics</p>
                <h2>Event information</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Artist</span>
                <input name="artist" placeholder="Melo North" required />
              </label>
              <GigLocationFields arenaCatalog={scmInfoSettings.arenaInfo.catalog} />
              <label className="field">
                <span>Date</span>
                <input name="date" type="date" required />
              </label>
              <PromoterAutocompleteField
                name="promoter"
                label="Promoter"
                placeholder="LIVE NATION"
              />
            </div>
          </section>

          <section className="card create-gig-primary-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Merch INFO</p>
                <h2>Merch details and forecast</h2>
              </div>
            </div>

            <div className="field-grid">
              <MerchCompanyAutocompleteField
                name="merchCompany"
                label="Merch company"
                placeholder="SCM"
              />
              <label className="field">
                <span>Merch representative</span>
                <input name="merchRepresentative" placeholder="Anna Reid" />
              </label>
              <ScmRepresentativeSelector
                label="SCM representative"
                name="scmRepresentative"
                placeholder="Anton"
                scmStaffOptions={scmRepresentativeOptions}
                temporaryGigManagerOptions={temporaryGigManagerOptions}
                temporaryGigManagerFieldName="scmRepresentativeTemporaryGigManagerStaffProfileId"
                scmStaffHelperText="Optional. Type to search and choose an SCM Staff profile."
                temporaryGigManagerHelperText="Choose a Staff profile to use as Temporary Gig Manager. Access is activated when the gig is saved."
              />
              <label className="field">
                <span>Tickets sold</span>
                <input name="ticketsSold" type="number" placeholder="12000" min="0" />
              </label>
              <label className="field full-width">
                <span>Avg. spend per person</span>
                <input name="estimatedSpendPerVisitor" type="number" placeholder="145" min="0" />
              </label>
            </div>
          </section>
        </div>

        <div className="create-gig-secondary-grid">
          <div className="create-gig-secondary-column">
            <NotesPlanningSection />
          </div>

          <div className="create-gig-secondary-column create-gig-files-column">
            {createdGig ? (
              <GigDocumentBoxes
                gigId={createdGig.id}
                section="files"
                title="Files"
                description="Keep e-mails, price ranges, and supporting gig information grouped in simple file boxes."
                createEyebrow="Custom file boxes"
                createTitle="Add another file or info box"
                createDescription="Create extra boxes for documents that do not belong in the two default file boxes."
                addButtonLabel="Add custom box"
                initialFiles={createdGig.files ?? []}
                initialFolders={createdGig.fileFolders ?? []}
              />
            ) : (
              <section className="card create-gig-files-placeholder">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Files</p>
                    <h2>Files</h2>
                  </div>

                  <span className="chip create-gig-files-placeholder-chip">
                    Unlock after first save
                  </span>
                </div>

                <p className="muted">
                  Save the gig once to unlock the same file-box workflow used in the gig&apos;s
                  Files &amp; info page.
                </p>
              </section>
            )}
          </div>

          <div className="create-gig-secondary-column">
            <EquipmentSection />
          </div>
        </div>

        <div className="page-actions">
          <button type="submit" name="intent" value="continue" className="button">
            Save and continue
          </button>
        </div>
      </form>

      {createdGig ? (
        <div className="create-gig-step-overlay" role="dialog" aria-modal="true">
          <div className="card create-gig-step-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Next step</p>
                <h2>Who is Project manager?</h2>
              </div>
            </div>

            <p className="muted">
              <strong>{createdGig.artist}</strong> has been saved. Choose the project manager
              before continuing.
            </p>

            <form action={saveProjectManagerStep} className="stack-column">
              <input type="hidden" name="gigId" value={createdGig.id} />

              <label className="field">
                <span>Project manager</span>
                <select name="projectManager" defaultValue="" required>
                  <option value="" disabled>
                    Select project manager
                  </option>
                  {projectManagerOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="page-actions">
                <Link href={`/gigs/${createdGig.id}`} className="button ghost">
                  Skip for now
                </Link>
                <button type="submit" className="button">
                  Save and open gig
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
