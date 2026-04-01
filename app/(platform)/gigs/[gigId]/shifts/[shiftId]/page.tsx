import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PageHeader } from "@/components/page-header";
import { ShiftOverviewEditor } from "@/components/shift-overview-editor";
import { requireCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { formatDateLabel } from "@/data/scm-data";
import { getStoredGigById } from "@/lib/gig-store";
import { canAccessPlatformGig } from "@/lib/platform-access";
import {
  getAvailableStaffProfilesForShift,
  getStoredShiftById,
  isStaffEligibleForShift,
} from "@/lib/shift-store";
import { getAllStaffAppAccounts } from "@/lib/staff-app-store";
import { getAllStoredStaffProfiles } from "@/lib/staff-store";
import {
  getAllStaffAppGigApplications,
  getShiftApplicantAppliedAtByStaffProfileId,
} from "@/lib/staff-app-gig-application-store";

type ShiftDetailPageProps = {
  params: Promise<{ gigId: string; shiftId: string }>;
};

export default async function ShiftDetailPage({
  params,
}: ShiftDetailPageProps) {
  noStore();
  const { gigId, shiftId } = await params;
  const currentProfile = await requireCurrentAuthenticatedScmStaffProfile();

  const [gig, shift, staffAppAccounts, applications, staffProfiles] = await Promise.all([
    getStoredGigById(gigId),
    getStoredShiftById(shiftId),
    getAllStaffAppAccounts(),
    getAllStaffAppGigApplications(),
    getAllStoredStaffProfiles(),
  ]);

  if (!gig || !shift || shift.gigId !== gig.id) {
    notFound();
  }

  if (!canAccessPlatformGig(currentProfile, gig)) {
    notFound();
  }

  const applicantAppliedAtByStaffId = getShiftApplicantAppliedAtByStaffProfileId(
    shiftId,
    applications,
    staffAppAccounts,
  );
  const availableCandidates = await getAvailableStaffProfilesForShift(gig, shift, {
    includeStaffIds: [...applicantAppliedAtByStaffId.keys()],
  });
  const includedCandidateIds = new Set([
    ...applicantAppliedAtByStaffId.keys(),
    ...shift.assignments.map((assignment) => assignment.staffId),
  ]);
  const candidateById = new Map(
    [...staffProfiles]
      .filter(
        (profile) =>
          profile.approvalStatus === "Approved" || includedCandidateIds.has(profile.id),
      )
      .map((profile) => [profile.id, profile]),
  );
  const availableCandidateIds = new Set(
    availableCandidates.map((candidate) => candidate.id),
  );

  const editorCandidateById = new Map(
    [...candidateById.values()].map((candidate) => [
      candidate.id,
      {
        id: candidate.id,
        displayName: candidate.displayName,
        region: candidate.region,
        country: candidate.country,
        roles: candidate.roles,
        approvalStatus: candidate.approvalStatus,
        appliedAt: applicantAppliedAtByStaffId.get(candidate.id),
        manualOverrideRequired:
          !availableCandidateIds.has(candidate.id) &&
          !isStaffEligibleForShift(candidate, gig, shift),
      },
    ]),
  );

  return (
    <>
      <PageHeader
        title={`${shift.role} Shift | ${shift.startTime} to ${shift.endTime}`}
        subtitle={`${gig.artist} | ${gig.arena} | ${formatDateLabel(gig.date)}`}
        actions={
          <Link href={`/gigs/${gig.id}?tab=shifts`} className="button ghost">
            Back to shifts
          </Link>
        }
      />

      <ShiftOverviewEditor
        gigId={gig.id}
        gigArtist={gig.artist}
        dateLabel={formatDateLabel(gig.date)}
        shift={shift}
        candidates={[...editorCandidateById.values()].sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        )}
      />
    </>
  );
}
