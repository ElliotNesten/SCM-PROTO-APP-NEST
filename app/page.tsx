import { redirect } from "next/navigation";

import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";

export default async function HomePage() {
  const currentProfile = await getCurrentAuthenticatedScmStaffProfile();
  redirect(currentProfile ? "/dashboard" : "/login");
}
