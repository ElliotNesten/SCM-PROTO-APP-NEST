import Image from "next/image";

import { getBrandSettings } from "@/lib/brand-store";

export async function StaffAppTopbarBrandLogo() {
  const brandSettings = await getBrandSettings();

  return (
    <span className="staff-app-brand-logo-frame" aria-hidden="true">
      <Image
        src={brandSettings.logoUrl}
        alt="SCM"
        fill
        sizes="96px"
        className="staff-app-brand-logo"
        unoptimized
        priority
      />
    </span>
  );
}
