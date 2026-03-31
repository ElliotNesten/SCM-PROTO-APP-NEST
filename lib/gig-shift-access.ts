import { resolveGigOverviewIndicator } from "@/data/scm-data";
import type { Gig, GigOverviewIndicator } from "@/types/scm";

const allowedShiftCreationIndicators = new Set<GigOverviewIndicator>([
  "inProgress",
  "confirmed",
]);

type ShiftCreationGig = Pick<Gig, "status" | "overviewIndicator">;

export function canCreateShiftsForGig(gig: ShiftCreationGig) {
  return allowedShiftCreationIndicators.has(resolveGigOverviewIndicator(gig));
}

export function getGigShiftCreationMessage(gig: ShiftCreationGig) {
  if (canCreateShiftsForGig(gig)) {
    return null;
  }

  const indicator = resolveGigOverviewIndicator(gig);

  if (indicator === "noMerch") {
    return "Shifts cannot be created while this gig is marked as No merch.";
  }

  return "Mark this gig as In Progress or Confirmed before creating shifts.";
}
