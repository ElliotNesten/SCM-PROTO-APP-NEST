"use client";

import { GigDocumentBoxes } from "@/components/gig-document-boxes";
import type { TimeReportStaffProfile } from "@/components/gig-time-report-panel";
import type { GigFileFolder, GigFileItem, Shift } from "@/types/scm";

export function GigReportDocuments({
  gigId,
  gigArtist,
  gigDate,
  timeReportFinalApprovedAt,
  initialFiles,
  initialFolders,
  shifts,
  staffProfiles,
}: {
  gigId: string;
  gigArtist: string;
  gigDate: string;
  timeReportFinalApprovedAt?: string;
  initialFiles: GigFileItem[];
  initialFolders: GigFileFolder[];
  shifts: Shift[];
  staffProfiles: TimeReportStaffProfile[];
}) {
  return (
    <GigDocumentBoxes
      gigId={gigId}
      gigArtist={gigArtist}
      section="reports"
      title="Reports"
      description="Three default report boxes stay visible for every gig. Add custom boxes when you need extra categories."
      createEyebrow="Custom report boxes"
      createTitle="Add another report box"
      createDescription="Create a titled box for extra reporting needs, then upload files directly inside it."
      addButtonLabel="Add custom box"
      initialFiles={initialFiles}
      initialFolders={initialFolders}
      timeReportGigDate={gigDate}
      timeReportFinalApprovedAt={timeReportFinalApprovedAt}
      timeReportShifts={shifts}
      timeReportStaffProfiles={staffProfiles}
    />
  );
}
