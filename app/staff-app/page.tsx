import { redirect } from "next/navigation";

import { getCurrentStaffAppHomePath } from "@/lib/staff-app-session";

export default async function StaffAppIndexPage() {
  redirect(await getCurrentStaffAppHomePath());
}
