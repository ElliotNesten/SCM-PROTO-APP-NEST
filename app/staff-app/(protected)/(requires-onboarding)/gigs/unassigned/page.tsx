import Link from "next/link";

import { StaffAppGigFeedCard } from "@/components/staff-app/gig-flow";
import { getStaffAppUnassignedPasses } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppUnassignedGigsPage() {
  const account = await requireCurrentStaffAppAccount();
  const passes = await getStaffAppUnassignedPasses(account);

  return (
    <section className="staff-app-screen staff-app-gigs-screen">
      <Link href="/staff-app/gigs" className="staff-app-back-link">
        Back
      </Link>

      <div className="staff-app-page-head">
        <h1>Unassigned Passes</h1>
      </div>

      {passes.length === 0 ? (
        <div className="staff-app-empty-state">No unassigned passes are currently visible on your profile.</div>
      ) : (
        <div className="staff-app-list">
          {passes.map((pass) => (
            <StaffAppGigFeedCard
              key={pass.id}
              pass={pass}
              badgeLabel="Unassigned"
            />
          ))}
        </div>
      )}
    </section>
  );
}
