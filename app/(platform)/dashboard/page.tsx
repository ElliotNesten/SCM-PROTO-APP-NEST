import { DashboardClient } from "@/app/(platform)/dashboard/dashboard-client";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getAllStoredGigs } from "@/lib/gig-store";
import { filterPlatformGigsForProfile } from "@/lib/platform-access";

export default async function DashboardPage() {
  const [profile, gigs] = await Promise.all([
    requireCurrentAuthenticatedScmStaffProfile(),
    getAllStoredGigs(),
  ]);

  return (
    <DashboardClient
      gigs={filterPlatformGigsForProfile(gigs, profile)}
      firstName={profile.firstName}
    />
  );
}
