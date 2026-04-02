import Link from "next/link";
import { notFound } from "next/navigation";

import {
  GigTimeReportPanel,
  type TimeReportStaffProfile,
} from "@/components/gig-time-report-panel";
import { formatStaffAppDate } from "@/lib/staff-app-data";
import { getStoredGigTimeReportShifts } from "@/lib/gig-time-report-store";
import { getAllStoredStaffProfiles } from "@/lib/staff-store";
import { getStaffAppScmGigWorkspace } from "@/lib/staff-app-scm-ops";
import { requireCurrentStaffAppScmProfile } from "@/lib/staff-app-session";

type StaffAppScmTimeReportPageProps = {
  params: Promise<{
    gigId: string;
  }>;
};

function countConfirmedAssignments(
  shifts: Awaited<ReturnType<typeof getStoredGigTimeReportShifts>>,
) {
  return shifts.reduce(
    (count, shift) =>
      count +
      shift.assignments.filter((assignment) => assignment.bookingStatus === "Confirmed").length,
    0,
  );
}

function countApprovedAssignments(
  shifts: Awaited<ReturnType<typeof getStoredGigTimeReportShifts>>,
) {
  return shifts.reduce(
    (count, shift) =>
      count +
      shift.assignments.filter(
        (assignment) =>
          assignment.bookingStatus === "Confirmed" && assignment.timeReportApproved === true,
      ).length,
    0,
  );
}

function countMealSelections(
  shifts: Awaited<ReturnType<typeof getStoredGigTimeReportShifts>>,
) {
  return shifts.reduce(
    (count, shift) =>
      count +
      shift.assignments.filter(
        (assignment) =>
          assignment.bookingStatus === "Confirmed" &&
          (assignment.lunchProvided === true || assignment.dinnerProvided === true),
      ).length,
    0,
  );
}

export default async function StaffAppScmTimeReportPage({
  params,
}: StaffAppScmTimeReportPageProps) {
  const { gigId } = await params;
  const profile = await requireCurrentStaffAppScmProfile();
  const workspace = await getStaffAppScmGigWorkspace(profile, gigId);

  if (!workspace) {
    notFound();
  }

  const [timeReportShifts, staffProfiles] = await Promise.all([
    getStoredGigTimeReportShifts(gigId),
    getAllStoredStaffProfiles(),
  ]);
  const staffProfileMap = new Map(staffProfiles.map((person) => [person.id, person]));
  const timeReportStaffIds = Array.from(
    new Set(
      timeReportShifts.flatMap((shift) =>
        shift.assignments
          .filter((assignment) => assignment.bookingStatus === "Confirmed")
          .map((assignment) => assignment.staffId),
      ),
    ),
  );
  const mappedStaffProfiles = timeReportStaffIds.map((staffId) => {
    const staffProfile = staffProfileMap.get(staffId);
    const rosterEntry = workspace.roster.find((entry) => entry.staffId === staffId);

    return {
      id: staffId,
      displayName: staffProfile?.displayName ?? rosterEntry?.staffName ?? staffId,
      region: staffProfile?.region ?? "",
      country: staffProfile?.country ?? "",
    } satisfies TimeReportStaffProfile;
  });
  const livePath = `/staff-app/scm/live/${gigId}`;
  const confirmedCount = countConfirmedAssignments(timeReportShifts);
  const approvedCount = countApprovedAssignments(timeReportShifts);
  const mealCount = countMealSelections(timeReportShifts);

  return (
    <section className="staff-app-screen staff-app-scm-screen staff-app-scm-live-screen">
      <div className="staff-app-card staff-app-scm-live-hero shift-detail">
        <div className="staff-app-scm-live-hero-copy">
          <p className="staff-app-kicker">Time report</p>
          <h1>{workspace.gig.artist}</h1>
          <p>
            {workspace.gig.arena}, {workspace.gig.city}
          </p>
        </div>

        <div className="staff-app-scm-live-pill-row">
          <span className="staff-app-scm-live-pill">{formatStaffAppDate(workspace.gig.date)}</span>
          <span className="staff-app-scm-live-pill subtle">
            {approvedCount}/{confirmedCount} approved
          </span>
          <span className="staff-app-scm-live-pill subtle">{mealCount} meals logged</span>
        </div>

        <div className="staff-app-scm-live-inline-stats">
          <span>{timeReportShifts.length} passes in report</span>
          <span>{confirmedCount - approvedCount} still need approval</span>
          <span>
            {workspace.gig.timeReportFinalApprovedAt ? "Final report approved" : "Final approval pending"}
          </span>
        </div>

        <div className="staff-app-scm-live-action-grid">
          <Link href={livePath} className="staff-app-button secondary">
            Back to live view
          </Link>
          <a href="#time-report" className="staff-app-button">
            Open time report
          </a>
        </div>
      </div>

      <div className="staff-app-card">
        <GigTimeReportPanel
          gigId={gigId}
          gigDate={workspace.gig.date}
          timeReportFinalApprovedAt={workspace.gig.timeReportFinalApprovedAt}
          shifts={timeReportShifts}
          staffProfiles={mappedStaffProfiles}
          apiBasePath={`/api/staff-app/scm/live/${gigId}`}
        />
      </div>
    </section>
  );
}
