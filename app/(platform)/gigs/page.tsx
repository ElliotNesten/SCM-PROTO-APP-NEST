import { unstable_noStore as noStore } from "next/cache";

import { GigRegisterClient } from "@/components/gig-register-client";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { getAllStoredGigs } from "@/lib/gig-store";
import { canCreatePlatformGigs, filterPlatformGigsForProfile } from "@/lib/platform-access";

type GigsPageProps = {
  searchParams?: Promise<{
    view?: string | string[];
    country?: string | string[];
  }>;
};

const countryOptions = ["Sweden", "Norway", "Denmark", "Finland"] as const;

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveInitialViewMode(value: string | undefined) {
  if (value === "toBeClosed" || value === "archived") {
    return value;
  }

  return "active" as const;
}

function resolveInitialCountryFilter(value: string | undefined) {
  return countryOptions.some((country) => country === value)
    ? (value as (typeof countryOptions)[number])
    : "all";
}

export default async function GigsPage({ searchParams }: GigsPageProps) {
  noStore();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [profile, gigs] = await Promise.all([
    requireCurrentAuthenticatedScmStaffProfile(),
    getAllStoredGigs(),
  ]);
  const initialViewMode = resolveInitialViewMode(pickQueryValue(resolvedSearchParams?.view));
  const initialCountryFilter = resolveInitialCountryFilter(
    pickQueryValue(resolvedSearchParams?.country),
  );
  const registerKey = `${initialViewMode}:${initialCountryFilter}`;

  return (
    <GigRegisterClient
      key={registerKey}
      gigs={filterPlatformGigsForProfile(gigs, profile)}
      canCreateGig={canCreatePlatformGigs(profile.roleKey)}
      initialViewMode={initialViewMode}
      initialCountryFilter={initialCountryFilter}
    />
  );
}
