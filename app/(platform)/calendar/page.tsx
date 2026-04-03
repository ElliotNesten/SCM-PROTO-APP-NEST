import { CalendarClient } from "@/components/calendar-client";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getAllStoredGigs } from "@/lib/gig-store";
import { filterPlatformGigsForProfile } from "@/lib/platform-access";

export default async function CalendarPage() {
  const [profile, gigs] = await Promise.all([
    requireCurrentAuthenticatedScmStaffProfile(),
    getAllStoredGigs(),
  ]);

  return <CalendarClient gigs={filterPlatformGigsForProfile(gigs, profile)} />;
}
