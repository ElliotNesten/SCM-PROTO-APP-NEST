import { redirect } from "next/navigation";

import { getStaffAppScmOperationsBoard } from "@/lib/staff-app-scm-ops";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

export default async function StaffAppScmOverviewPage() {
  const profile = await requireCurrentStaffAppScmProfile();
  const board = await getStaffAppScmOperationsBoard(profile);

  if (board.primaryGigId) {
    redirect(`/staff-app/scm/live/${board.primaryGigId}`);
  }

  redirect("/staff-app/scm/gigs");
}
