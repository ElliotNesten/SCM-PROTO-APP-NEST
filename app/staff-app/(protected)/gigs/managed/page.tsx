import Link from "next/link";

import { StaffAppManagedGigCard } from "@/components/staff-app/gig-flow";
import { getStaffAppManagedGigs } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppManagedGigsPage() {
  const account = await requireCurrentStaffAppAccount();
  const managedGigs = await getStaffAppManagedGigs(account);

  return (
    <section className="staff-app-screen staff-app-gigs-screen">
      <Link href="/staff-app/gigs" className="staff-app-back-link">
        Back
      </Link>

      <div className="staff-app-page-head">
        <h1>Shared Gig Info</h1>
        <p>Gigs where you have Temporary Gig Manager access.</p>
      </div>

      {managedGigs.length === 0 ? (
        <div className="staff-app-empty-state">
          No shared gig info is visible right now.
        </div>
      ) : (
        <div className="staff-app-list-stack">
          {managedGigs.map((gig) => (
            <StaffAppManagedGigCard key={gig.id} gig={gig} />
          ))}
        </div>
      )}
    </section>
  );
}
