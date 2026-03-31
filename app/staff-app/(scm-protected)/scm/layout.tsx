import type { ReactNode } from "react";

import { StaffAppScmMobileShell } from "@/components/staff-app/scm-mobile-shell";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

export default async function StaffAppScmLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireCurrentStaffAppScmProfile();

  return <StaffAppScmMobileShell profile={profile}>{children}</StaffAppScmMobileShell>;
}
