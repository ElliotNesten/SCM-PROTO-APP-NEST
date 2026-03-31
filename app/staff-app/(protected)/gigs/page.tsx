import { StaffAppGigFeedCard, StaffAppGigOverviewCard } from "@/components/staff-app/gig-flow";
import { getStaffAppGigOverview } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppGigsPage() {
  const account = await requireCurrentStaffAppAccount();
  const overview = await getStaffAppGigOverview(account);

  return (
    <section className="staff-app-screen staff-app-gigs-screen">
      <div className="staff-app-page-head">
        <h1>Upcoming Gigs</h1>
        <p>See available work and manage your status.</p>
      </div>

      <div className="staff-app-gig-overview-stack">
        <div>
          <div className="staff-app-section-head compact">
            <div>
              <h2>Open Gigs</h2>
            </div>
            <span className="staff-app-badge neutral">
              {overview.openPasses.length} available shift
              {overview.openPasses.length === 1 ? "" : "s"}
            </span>
          </div>

          {overview.openPasses.length === 0 ? (
            <div className="staff-app-empty-state">
              No open gigs currently match your staff eligibility.
            </div>
          ) : (
            <div className="staff-app-list">
              {overview.openPasses.map((pass) => (
                <StaffAppGigFeedCard
                  key={pass.id}
                  pass={pass}
                  actionLabel="Apply"
                  actionHref={`/staff-app/gigs/${pass.id}`}
                />
              ))}
            </div>
          )}
        </div>

        {overview.managedGigs.length > 0 ? (
          <StaffAppGigOverviewCard
            href="/staff-app/gigs/managed"
            title="Shared Gig Info"
            description="Gig access shared with you as Temporary Gig Manager."
            countLabel={`${overview.managedGigs.length} shared gig${overview.managedGigs.length === 1 ? "" : "s"}`}
          />
        ) : null}

        <div className="staff-app-gig-overview-grid">
          <StaffAppGigOverviewCard
            href="/staff-app/gigs/standby"
            title="Waitlist"
            description="Track shifts where you are on the waitlist."
            countLabel={`${overview.standbyPasses.length} waitlist position${overview.standbyPasses.length === 1 ? "" : "s"}`}
          />
          <StaffAppGigOverviewCard
            href="/staff-app/gigs/unassigned"
            title="Unassigned"
            description="Review passes not booked to you."
            countLabel={`${overview.unassignedPasses.length} unassigned shifts`}
          />
        </div>
      </div>
    </section>
  );
}
