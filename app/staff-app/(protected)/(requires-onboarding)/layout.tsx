import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { StaffAppMobileShell } from "@/components/staff-app/mobile-shell";
import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppRequiresOnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await requireCurrentStaffAppAccount();

  if (account.mustCompleteOnboarding) {
    redirect("/staff-app/onboarding");
  }

  return <StaffAppMobileShell account={account}>{children}</StaffAppMobileShell>;
}
