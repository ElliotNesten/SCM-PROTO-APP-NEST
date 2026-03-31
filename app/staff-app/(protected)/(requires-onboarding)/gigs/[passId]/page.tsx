import Link from "next/link";
import { notFound } from "next/navigation";

import { applyToStaffAppGigPass } from "@/app/staff-app/actions";
import {
  StaffAppGigArtwork,
  StaffAppGigMetaIcon,
  formatStaffAppGigLine,
} from "@/components/staff-app/gig-flow";
import { getStaffAppGigPassById } from "@/lib/staff-app-data";
import { getStaffAppGigApplication } from "@/lib/staff-app-gig-application-store";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

type StaffAppGigDetailPageProps = {
  params: Promise<{ passId: string }>;
  searchParams: Promise<{ applied?: string }>;
};

export default async function StaffAppGigDetailPage({
  params,
  searchParams,
}: StaffAppGigDetailPageProps) {
  const account = await requireCurrentStaffAppAccount();
  const { passId } = await params;
  const { applied } = await searchParams;
  const pass = await getStaffAppGigPassById(account, passId);

  if (!pass || pass.feed !== "open") {
    notFound();
  }

  const application = await getStaffAppGigApplication(account.id, pass.id);
  const isApplied = Boolean(application);

  return (
    <section className="staff-app-screen staff-app-gigs-screen">
      <Link href="/staff-app/gigs" className="staff-app-back-link">
        Back
      </Link>

      <div className="staff-app-page-head">
        <h1>Open Gig</h1>
      </div>

      {applied === "success" ? (
        <div className="staff-app-inline-alert success">
          Your application has been saved for this gig.
        </div>
      ) : null}

      <div
        className="staff-app-card staff-app-open-gig-card"
        data-text-edit-exclude="true"
      >
        <StaffAppGigArtwork imageUrl={pass.imageUrl} title={pass.artist} large />

        <div className="staff-app-open-gig-copy">
          <h2>{pass.artist}</h2>

          <div className="staff-app-gig-feed-meta">
            <span>
              <StaffAppGigMetaIcon kind="calendar" />
              {formatStaffAppGigLine(pass)}
            </span>
            <span>
              <StaffAppGigMetaIcon kind="pin" />
              {pass.city}, {pass.arena}
            </span>
          </div>
        </div>
      </div>

      <div className="staff-app-card">
        <div className="staff-app-section-head compact">
          <div>
            <p className="staff-app-kicker">Shift Details</p>
          </div>
        </div>

        <div className="staff-app-detail-grid">
          <div className="staff-app-detail-cell">
            <span>Position</span>
            <strong>{pass.role}</strong>
          </div>
          <div className="staff-app-detail-cell">
            <span>Pay rate</span>
            <strong>{pass.payRateLabel}</strong>
          </div>
          <div className="staff-app-detail-cell full">
            <span>Comment</span>
            <strong>{pass.operationsNote}</strong>
          </div>
        </div>
      </div>

      <form action={applyToStaffAppGigPass}>
        <input type="hidden" name="passId" value={pass.id} />
        <button type="submit" className="staff-app-button" disabled={isApplied}>
          {isApplied ? "Applied" : "Apply for Gig"}
        </button>
      </form>
    </section>
  );
}
