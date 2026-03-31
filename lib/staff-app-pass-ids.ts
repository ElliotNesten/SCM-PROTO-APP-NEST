import type { StaffAppOpenPass } from "@/types/staff-app";

type StaffAppPassFeed = StaffAppOpenPass["feed"];

export function buildStaffAppOpenPassId(shiftId: string) {
  return `pass-open-${shiftId}`;
}

export function buildStaffAppFeedPassId(
  feed: StaffAppPassFeed,
  shiftId: string,
) {
  if (feed === "open") {
    return buildStaffAppOpenPassId(shiftId);
  }

  return `pass-${feed}-${shiftId}`;
}
