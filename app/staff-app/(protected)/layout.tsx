import type { ReactNode } from "react";

import { requireCurrentStaffAppAccount } from "@/lib/staff-app-session";

export default async function StaffAppProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentStaffAppAccount();
  return children;
}
