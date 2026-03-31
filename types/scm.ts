import type {
  CompensationCountry,
  CompensationCurrency,
  CompensationSource,
} from "@/types/compensation";

export type GigStatus =
  | "Identified"
  | "Planning"
  | "Published"
  | "Confirmed"
  | "Investigating"
  | "Completed"
  | "Reported"
  | "Closed";

export type BookingStatus = "Confirmed" | "Pending" | "Waitlisted";

export type StaffApprovalStatus = "Approved" | "Applicant" | "Archived";

export type PriorityTag = "High" | "Medium" | "Low";

export type GigOverviewIndicator =
  | "identified"
  | "inProgress"
  | "confirmed"
  | "noMerch";

export type GigTab =
  | "overview"
  | "files"
  | "shifts"
  | "reports"
  | "closeout";

export type ShiftTab =
  | "overview"
  | "booking"
  | "waitlist"
  | "messages";

export type ShiftMessageAudience =
  | "bookedOnShift"
  | "standLeaders"
  | "individualPeople"
  | "customGroup";

export type ShiftMessageAuthorType = "scm" | "staff";

export type GigDocumentSection = "files" | "reports";

export type GigFileStorageMode = "public" | "attachment";

export interface Assignment {
  staffId: string;
  bookingStatus: BookingStatus;
  hourlyRate?: number;
  hourlyRateCurrency?: CompensationCurrency;
  hourlyRateCountry?: CompensationCountry;
  hourlyRateSource?: CompensationSource;
  checkedIn?: string;
  checkedOut?: string;
  lunchProvided?: boolean;
  dinnerProvided?: boolean;
  timeReportApproved?: boolean;
  timeReportApprovedAt?: string;
}

export interface GigTemporaryManagerAssignment {
  id: string;
  staffProfileId: string;
  assignedAt: string;
}

export interface Gig {
  id: string;
  artist: string;
  arena: string;
  city: string;
  country: string;
  region: string;
  date: string;
  startTime: string;
  endTime: string;
  promoter: string;
  merchCompany: string;
  merchRepresentative: string;
  scmRepresentative: string;
  projectManager?: string;
  ticketsSold: number;
  estimatedSpendPerVisitor: number;
  status: GigStatus;
  progress: number;
  staffingProgress: number;
  alertCount: number;
  notes: string;
  salesEstimateOverride?: number;
  overviewIndicator?: GigOverviewIndicator;
  profileImageUrl?: string;
  arenaNotes?: string;
  securitySetup?: string;
  generalComments?: string;
  customNoteFields?: GigCommentField[];
  equipment?: GigEquipmentItem[];
  files?: GigFileItem[];
  fileFolders?: GigFileFolder[];
  temporaryGigManagers?: GigTemporaryManagerAssignment[];
  invoicesPaidAt?: string;
  economyComment?: string;
  timeReportFinalApprovedAt?: string;
  closedAt?: string;
  closedByProfileId?: string;
  closedByName?: string;
  closeOverrideUsed?: boolean;
  statusBeforeClose?: GigStatus;
  progressBeforeClose?: number;
}

export interface GigCommentField {
  id: string;
  title: string;
  body: string;
}

export interface GigEquipmentItem {
  key: string;
  label: string;
  quantity: number;
}

export interface GigFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  mimeType: string;
  extension: string;
  url: string;
  storageMode?: GigFileStorageMode;
  storagePath?: string;
  section?: GigDocumentSection;
  folderId?: string;
  folderName?: string;
}

export interface GigFileFolder {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  section?: GigDocumentSection;
}

export interface Shift {
  id: string;
  gigId: string;
  role: string;
  priorityLevel: number;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  notes: string;
  skillRequirement?: string;
  priorityTag: PriorityTag;
  assignments: Assignment[];
}

export interface ShiftMessageGroup {
  id: string;
  gigId: string;
  name: string;
  memberIds: string[];
  createdAt: string;
}

export interface ShiftMessageAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  mimeType: string;
  extension: string;
  url: string;
  storagePath: string;
}

export interface ShiftMessageRecord {
  id: string;
  gigId: string;
  audience: ShiftMessageAudience;
  audienceLabel: string;
  recipientIds: string[];
  shiftId?: string;
  groupId?: string;
  threadId?: string;
  body: string;
  createdAt: string;
  authorName?: string;
  authorProfileId?: string;
  authorType?: ShiftMessageAuthorType;
  allowReplies?: boolean;
  attachments?: ShiftMessageAttachment[];
}

export interface ShiftCommunicationState {
  gigId: string;
  customGroups: ShiftMessageGroup[];
  messages: ShiftMessageRecord[];
}

export interface StaffMember {
  id: string;
  name: string;
  country: string;
  region: string;
  email: string;
  phone: string;
  roles: string[];
  priority: number;
  availability: string;
  approvalStatus: StaffApprovalStatus;
}

export interface RouteTab<T extends string> {
  slug: T;
  label: string;
}

export interface OpsSignal {
  title: string;
  detail: string;
  tone: "info" | "warn" | "success" | "danger";
}
