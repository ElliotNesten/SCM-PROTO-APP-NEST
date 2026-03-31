import type { ReactNode } from "react";

import { StaffAppMobileShell } from "@/components/staff-app/mobile-shell";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await requireCurrentStaffAppAccount();

  return <StaffAppMobileShell account={account}>{children}</StaffAppMobileShell>;
}
