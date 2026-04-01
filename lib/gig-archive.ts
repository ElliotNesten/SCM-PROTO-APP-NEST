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

function getTodayGigDate() {
  return normalizeGigDate(new Date());
}

export function isGigStatusClosed(status: GigStatus) {
  return ["Completed", "Reported", "Closed"].includes(status);
}

export function isGigClosedForRegister(
  gig: Pick<Gig, "status" | "overviewIndicator">,
) {
  const overviewIndicator = resolveGigOverviewIndicator(gig);
  return isGigStatusClosed(gig.status) || overviewIndicator === "noMerch";
}

export function isGigArchivedForRegister(gig: Pick<Gig, "date">) {
  return getGigDate(gig.date) < getTodayGigDate();
}

export type GigRegisterSection = "active" | "toBeClosed" | "closed";

export function resolveGigRegisterSection(
  gig: Pick<Gig, "date" | "status" | "overviewIndicator">,
): GigRegisterSection {
  const today = getTodayGigDate();
  const gigDate = getGigDate(gig.date);
  const overviewIndicator = resolveGigOverviewIndicator(gig);

  if (isGigClosedForRegister(gig)) {
    return "closed";
  }

  if (gigDate < today && (overviewIndicator === "confirmed" || overviewIndicator === "inProgress")) {
    return "toBeClosed";
  }

  return "active";
}

export function isGigArchived(gig: Pick<Gig, "date" | "status" | "overviewIndicator">) {
  return isGigArchivedForRegister(gig);
}

export function isGigToBeClosed(
  gig: Pick<Gig, "date" | "status" | "overviewIndicator">,
) {
  return resolveGigRegisterSection(gig) === "toBeClosed";
}
