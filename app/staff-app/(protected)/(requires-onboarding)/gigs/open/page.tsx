import { redirect } from "next/navigation";

import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppOpenGigsPage() {
  await requireCurrentStaffAppAccount();
  redirect("/staff-app/gigs");
}
