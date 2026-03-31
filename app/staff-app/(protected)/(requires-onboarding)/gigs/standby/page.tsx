import Link from "next/link";

import { StaffAppGigFeedCard } from "@/components/staff-app/gig-flow";
import { getStaffAppStandbyPasses } from "@/lib/staff-app-data";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppStandbyGigsPage() {
  const account = await requireCurrentStaffAppAccount();
  const passes = await getStaffAppStandbyPasses(account);

  return (
    <section className="staff-app-screen staff-app-gigs-screen">
      <Link href="/staff-app/gigs" className="staff-app-back-link">
        Back
      </Link>

      <div className="staff-app-page-head">
        <h1>Waitlist</h1>
      </div>

      {passes.length === 0 ? (
        <div className="staff-app-empty-state">You are not currently on the waitlist for any eligible shift.</div>
      ) : (
        <div className="staff-app-list">
          {passes.map((pass) => (
            <StaffAppGigFeedCard
              key={pass.id}
              pass={pass}
              badgeLabel="Waitlist"
            />
          ))}
        </div>
      )}
    </section>
  );
}
