import { resolveGigOverviewIndicator } from "@/data/scm-data";
import type { Gig, GigStatus } from "@/types/scm";

function normalizeGigDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function getGigDate(dateValue: string) {
  return normalizeGigDate(new Date(`${dateValue}T12:00:00`));
}

export function isGigStatusArchived(status: GigStatus) {
  return ["Completed", "Reported", "Closed"].includes(status);
}

export type GigRegisterSection = "active" | "toBeClosed" | "archived";

export function resolveGigRegisterSection(
  gig: Pick<Gig, "date" | "status" | "overviewIndicator">,
): GigRegisterSection {
  const today = normalizeGigDate(new Date());
  const gigDate = getGigDate(gig.date);
  const overviewIndicator = resolveGigOverviewIndicator(gig);

  if (isGigStatusArchived(gig.status) || overviewIndicator === "noMerch") {
    return "archived";
  }

  if (gigDate < today && (overviewIndicator === "confirmed" || overviewIndicator === "inProgress")) {
    return "toBeClosed";
  }

  return "active";
}

export function isGigArchived(gig: Pick<Gig, "date" | "status" | "overviewIndicator">) {
  return resolveGigRegisterSection(gig) === "archived";
}

export function isGigToBeClosed(
  gig: Pick<Gig, "date" | "status" | "overviewIndicator">,
) {
  return resolveGigRegisterSection(gig) === "toBeClosed";
}
