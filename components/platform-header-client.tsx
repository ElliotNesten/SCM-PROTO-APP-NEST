"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PlatformHeaderClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/calendar")) {
    return null;
  }

  return (
    <header className="platform-header">
      <div className="platform-nav-row">
        <div className="platform-header-right">
          {children}
        </div>
      </div>
    </header>
  );
}
