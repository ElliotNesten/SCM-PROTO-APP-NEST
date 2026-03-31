import type { ReactNode } from "react";

import { PlatformShell } from "@/components/platform-shell";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await requireCurrentAuthenticatedScmStaffProfile();
  return <PlatformShell>{children}</PlatformShell>;
}
