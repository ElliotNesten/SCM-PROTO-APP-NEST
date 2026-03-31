import {
  getCanonicalGigDocumentBoxTitle,
  getReportGigFilesDocumentBoxTitle,
  normalizeGigDocumentBoxName,
} from "@/lib/gig-document-boxes";
import type { Gig, GigFileItem } from "@/types/scm";

export type GigCloseoutRequirementKey =
  | "timeReportApproved"
  | "eventManagerUploaded"
  | "gigFilesUploaded"
  | "invoicesPaid";

export type GigCloseoutRequirement = {
  key: GigCloseoutRequirementKey;
  label: string;
  satisfied: boolean;
};

export type GigCloseoutChecklist = {
  requirements: GigCloseoutRequirement[];
  allRequiredComplete: boolean;
};

function matchesReportDocumentBox(
  file: GigFileItem,
  gigArtist: string,
  expectedBoxTitle: string,
) {
  if (file.section !== "reports") {
    return false;
  }

  const folderName = file.folderName?.trim();

  if (!folderName) {
    return false;
  }

  return (
    normalizeGigDocumentBoxName(
      getCanonicalGigDocumentBoxTitle("reports", folderName, { gigArtist }),
    ) === normalizeGigDocumentBoxName(expectedBoxTitle)
  );
}

export function getGigCloseoutChecklist(
  gig: Pick<Gig, "artist" | "files" | "timeReportFinalApprovedAt" | "invoicesPaidAt">,
): GigCloseoutChecklist {
  const reportFiles = gig.files ?? [];
  const reportGigFilesTitle = getReportGigFilesDocumentBoxTitle({ gigArtist: gig.artist });
  const requirements: GigCloseoutRequirement[] = [
    {
      key: "timeReportApproved",
      label: "Time report approved",
      satisfied: Boolean(gig.timeReportFinalApprovedAt),
    },
    {
      key: "eventManagerUploaded",
      label: "Event Manager uploaded",
      satisfied: reportFiles.some((file) =>
        matchesReportDocumentBox(file, gig.artist, "Event Manager"),
      ),
    },
    {
      key: "gigFilesUploaded",
      label: "Gig files uploaded",
      satisfied: reportFiles.some((file) =>
        matchesReportDocumentBox(file, gig.artist, reportGigFilesTitle),
      ),
    },
    {
      key: "invoicesPaid",
      label: "Invoices paid",
      satisfied: Boolean(gig.invoicesPaidAt),
    },
  ];

  return {
    requirements,
    allRequiredComplete: requirements.every((requirement) => requirement.satisfied),
  };
}
