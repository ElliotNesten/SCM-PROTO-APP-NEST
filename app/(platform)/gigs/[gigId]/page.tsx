import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { DetailTabs } from "@/components/detail-tabs";
import { GigDeleteAction } from "@/components/gig-delete-action";
import { GigFilesManager } from "@/components/gig-files-manager";
import { GigImageUploader } from "@/components/gig-image-uploader";
import { GigOverviewEditor } from "@/components/gig-overview-editor";
import { GigReportCloseoutPanel } from "@/components/gig-report-closeout-panel";
import { GigReportDocuments } from "@/components/gig-report-documents";
import { GigShiftsPanel } from "@/components/gig-shifts-panel";
import type { TimeReportStaffProfile } from "@/components/gig-time-report-panel";
import { PageHeader } from "@/components/page-header";
import { getCurrentAuthenticatedScmStaffProfile } from "@/lib/auth-session";
import { buildScmStaffRepresentativeOptions, buildTemporaryGigManagerOptions } from "@/lib/scm-representative-options";
import {
  formatDateLabel,
  gigTabs,
} from "@/data/scm-data";
import { isGigArchived } from "@/lib/gig-archive";
import { getGigCloseoutChecklist } from "@/lib/gig-closeout";
import { getGigTemporaryManagerTimeline, getStoredGigById } from "@/lib/gig-store";
import {
  canCreateShiftsForGig,
  getGigShiftCreationMessage,
} from "@/lib/gig-shift-access";
import { getStoredGigTimeReportShifts } from "@/lib/gig-time-report-store";
import {
  canAccessPlatformGig,
  canManageGigShare,
} from "@/lib/platform-access";
import { getAllStoredScmStaffProfiles } from "@/lib/scm-staff-store";
import {
  getAvailableStaffProfilesForShift,
  getStoredGigShifts,
} from "@/lib/shift-store";
import { getAllStoredStaffProfiles } from "@/lib/staff-store";
import { getStoredShiftCommunication } from "@/lib/shift-communication-store";
import { getAllStaffAppGigApplications, getShiftApplicantAppliedAtByStaffProfileId } from "@/lib/staff-app-gig-application-store";
import { getAllStaffAppAccounts } from "@/lib/staff-app-store";
import { getSystemScmInfoSettings } from "@/lib/system-scm-info-store";
import type { GigTab } from "@/types/scm";
import type { ScmStaffRoleKey } from "@/types/scm-rbac";

type GigDetailPageProps = {
  params: Promise<{ gigId: string }>;
  searchParams: Promise<{ tab?: string | string[]; shiftTab?: string | string[] }>;
};

type GigShiftHubTab = "overview" | "booking" | "waitlist" | "messages";
type GigTemporaryManagerEntry = {
  staffProfileId: string;
  displayName: string;
  email: string;
  country: string;
  region: string;
  assignedAt: string;
  platformAccessEndsOn: string;
  visibleUntil: string;
};

function pickTab(
  value: string | string[] | undefined,
  shiftValue?: string | string[] | undefined,
): GigTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  const shiftCandidate = Array.isArray(shiftValue) ? shiftValue[0] : shiftValue;

  if (
    candidate === "time" ||
    ((candidate === undefined || candidate === "shifts") && shiftCandidate === "time")
  ) {
    return "reports";
  }

  if (
    candidate === "team" ||
    candidate === "messages" ||
    candidate === "contracts"
  ) {
    return "shifts";
  }

  const validTabs = new Set(gigTabs.map((tab) => tab.slug));
  return validTabs.has(candidate as GigTab) ? (candidate as GigTab) : "overview";
}

function pickShiftHubTab(value: string | string[] | undefined): GigShiftHubTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "booking") {
    return "booking";
  }

  if (candidate === "waitlist") {
    return "booking";
  }

  if (candidate === "messages") {
    return "messages";
  }

  return "overview";
}

function resolveCoreDetailsAccess(roleKey?: ScmStaffRoleKey) {
  if (roleKey === "superAdmin" || roleKey === "officeStaff") {
    return "full" as const;
  }

  if (roleKey === "regionalManager") {
    return "regionalManagerLimited" as const;
  }

  return "readOnly" as const;
}

export default async function GigDetailPage({
  params,
  searchParams,
}: GigDetailPageProps) {
  noStore();
  const { gigId } = await params;
  const { tab, shiftTab } = await searchParams;
  const requestedTab = pickTab(tab, shiftTab);
  const activeShiftTab = pickShiftHubTab(shiftTab);
  const gig = await getStoredGigById(gigId);
  const currentScmStaffProfile = await getCurrentAuthenticatedScmStaffProfile();
  const coreDetailsAccess = resolveCoreDetailsAccess(currentScmStaffProfile?.roleKey);
  const canDeleteArchivedGig =
    currentScmStaffProfile?.roleKey === "superAdmin" && gig ? isGigArchived(gig) : false;

  if (!gig) {
    notFound();
  }

  if (!canAccessPlatformGig(currentScmStaffProfile, gig)) {
    notFound();
  }

  const canCreateShifts = canCreateShiftsForGig(gig);
  const activeTab =
    !canCreateShifts && requestedTab === "shifts" ? "overview" : requestedTab;
  const shiftCreationMessage = getGigShiftCreationMessage(gig);
  const gigShifts = await getStoredGigShifts(gig.id);
  const reportShifts =
    activeTab === "reports" ? await getStoredGigTimeReportShifts(gig.id) : gigShifts;
  const [
    allStaffProfiles,
    allScmStaffProfiles,
    scmInfoSettings,
    staffAppAccounts,
    staffAppApplications,
  ] =
    activeTab === "overview" || activeTab === "shifts" || activeTab === "reports"
      ? await Promise.all([
          getAllStoredStaffProfiles(),
          activeTab === "overview" ? getAllStoredScmStaffProfiles() : Promise.resolve([]),
          activeTab === "overview" ? getSystemScmInfoSettings() : Promise.resolve(null),
          activeTab === "shifts" && activeShiftTab === "booking"
            ? getAllStaffAppAccounts()
            : Promise.resolve([]),
          activeTab === "shifts" && activeShiftTab === "booking"
            ? getAllStaffAppGigApplications()
            : Promise.resolve([]),
        ])
      : [[], [], null, [], []];
  const mappedStaffProfiles = allStaffProfiles.map((person) => ({
    id: person.id,
    displayName: person.displayName,
    region: person.region,
    country: person.country,
    roles: person.roles,
    approvalStatus: person.approvalStatus,
  }));
  const gigTemporaryManagerTimeline = getGigTemporaryManagerTimeline(gig.date);
  const gigCloseoutChecklist = getGigCloseoutChecklist(gig);
  const temporaryGigManagerEntries: GigTemporaryManagerEntry[] =
    activeTab === "overview"
      ? (gig.temporaryGigManagers ?? [])
          .map((assignment) => {
            const linkedStaffProfile = allStaffProfiles.find(
              (staffProfile) => staffProfile.id === assignment.staffProfileId,
            );

            if (!linkedStaffProfile) {
              return null;
            }

            return {
              staffProfileId: linkedStaffProfile.id,
              displayName: linkedStaffProfile.displayName,
              email: linkedStaffProfile.email,
              country: linkedStaffProfile.country,
              region: linkedStaffProfile.region,
              assignedAt: assignment.assignedAt,
              platformAccessEndsOn: gigTemporaryManagerTimeline.platformAccessEndsOn,
              visibleUntil: gigTemporaryManagerTimeline.visibleUntil,
            };
          })
          .filter((entry): entry is GigTemporaryManagerEntry => Boolean(entry))
      : [];
  const shiftCandidatePools =
    activeTab === "shifts" &&
    (activeShiftTab === "booking" || activeShiftTab === "waitlist")
      ? await Promise.all(
          gigShifts.map(async (shift) => {
            const applicantAppliedAtByStaffId = getShiftApplicantAppliedAtByStaffProfileId(
              shift.id,
              staffAppApplications,
              staffAppAccounts,
            );
            const candidates = await getAvailableStaffProfilesForShift(gig, shift, {
              includeStaffIds: [...applicantAppliedAtByStaffId.keys()],
            });

            return {
              shiftId: shift.id,
              candidates: candidates.map((person) => ({
                id: person.id,
                displayName: person.displayName,
                region: person.region,
                country: person.country,
                roles: person.roles,
                approvalStatus: person.approvalStatus,
              })),
            };
          }),
        )
      : [];
  const [staffProfiles, shiftCommunication] =
    activeTab === "shifts"
      ? await Promise.all([
          Promise.resolve(allStaffProfiles),
          getStoredShiftCommunication(gig.id),
        ])
      : [[], { gigId: gig.id, customGroups: [], messages: [] }];

  return (
    <>
      <PageHeader
        title={gig.artist}
        subtitle={`${gig.arena}, ${gig.city}, ${gig.country} | ${formatDateLabel(gig.date)}`}
        leading={
          <GigImageUploader
            gigId={gig.id}
            artist={gig.artist}
            initialImageUrl={gig.profileImageUrl}
          />
        }
        actions={
          <>
            {canDeleteArchivedGig ? (
              <GigDeleteAction gigId={gig.id} gigArtist={gig.artist} />
            ) : null}
            <Link href="/gigs" className="button ghost">
              Back to gigs
            </Link>
          </>
        }
      />

      <DetailTabs
        tabs={gigTabs}
        current={activeTab}
        basePath={`/gigs/${gig.id}`}
        blockedTabs={
          !canCreateShifts
            ? {
                shifts: {
                  title: "Shifts locked",
                  message:
                    "Shifts open when the gig is marked as In Progress or Confirmed.",
                },
              }
            : undefined
        }
      />

      {activeTab === "overview" ? (
        <GigOverviewEditor
          gig={gig}
          arenaCatalog={scmInfoSettings?.arenaInfo.catalog ?? []}
          coreDetailsAccess={coreDetailsAccess}
          canManageTemporaryGigManagers={canManageGigShare(currentScmStaffProfile?.roleKey)}
          scmStaffRepresentativeOptions={buildScmStaffRepresentativeOptions(
            allScmStaffProfiles,
          )}
          temporaryGigManagerOptions={buildTemporaryGigManagerOptions(allStaffProfiles)}
          temporaryGigManagers={temporaryGigManagerEntries}
        />
      ) : null}

      {activeTab === "files" ? (
        <GigFilesManager
          gigId={gig.id}
          initialFiles={gig.files ?? []}
          initialFolders={gig.fileFolders ?? []}
        />
      ) : null}

      {activeTab === "shifts" ? (
        <GigShiftsPanel
          gigId={gig.id}
          shifts={gigShifts}
          canCreateShifts={canCreateShifts}
          shiftCreationMessage={shiftCreationMessage}
          activeTab={activeShiftTab}
          candidatePools={shiftCandidatePools}
          staffProfiles={staffProfiles.map((person) => ({
            id: person.id,
            displayName: person.displayName,
            region: person.region,
            country: person.country,
            roles: person.roles,
            approvalStatus: person.approvalStatus,
          }))}
          initialCommunication={shiftCommunication}
        />
      ) : null}

      {activeTab === "reports" ? (
        <GigReportDocuments
          gigId={gig.id}
          gigArtist={gig.artist}
          gigDate={gig.date}
          timeReportFinalApprovedAt={gig.timeReportFinalApprovedAt}
          initialFiles={gig.files ?? []}
          initialFolders={gig.fileFolders ?? []}
          shifts={reportShifts}
          staffProfiles={mappedStaffProfiles as TimeReportStaffProfile[]}
        />
      ) : null}

      {activeTab === "closeout" ? (
        <section className="card report-closeout-shell">
          <GigReportCloseoutPanel
            gigId={gig.id}
            gigStatus={gig.status}
            initialChecklist={gigCloseoutChecklist}
            initialInvoicesPaidAt={gig.invoicesPaidAt}
            initialEconomyComment={gig.economyComment}
            initialClosedAt={gig.closedAt}
            initialClosedByName={gig.closedByName}
            canReopen={currentScmStaffProfile?.roleKey === "superAdmin"}
          />
        </section>
      ) : null}
    </>
  );
}
