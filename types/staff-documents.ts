export type StaffStoredDocumentTab = "employmentContracts" | "timeReports";

export type StaffStoredDocumentKind =
  | "Employment Contract"
  | "Time Report";

export type StaffStoredDocumentTrigger =
  | "shiftCompleted"
  | "timeReportApproved";

export interface StoredStaffDocument {
  id: string;
  userId: string;
  gigId: string;
  shiftId: string;
  gigName: string;
  gigDate: string;
  shiftRole: string;
  documentKind: StaffStoredDocumentKind;
  tab: StaffStoredDocumentTab;
  generatedAt: string;
  generatedBy: StaffStoredDocumentTrigger;
  fileName: string;
  fileType: "application/pdf";
  fileSize: number;
}
