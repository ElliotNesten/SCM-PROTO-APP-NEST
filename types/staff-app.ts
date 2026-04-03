export type StaffAppRole = "Seller" | "Stand Leader" | "Runner";
export type StaffAppScopeRole = StaffAppRole | "Other";
export type StaffAppLevel = 1 | 2 | 3 | 4 | 5;

export interface StaffAppRoleScope {
  role: StaffAppScopeRole;
  level: StaffAppLevel;
}

export interface StaffAppAccount {
  id: string;
  linkedStaffProfileId?: string;
  createdFromApplicationId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  roleScopes: StaffAppRoleScope[];
  profileImageUrl?: string;
  passwordHash: string;
  isActive: boolean;
  mustCompleteOnboarding: boolean;
  passwordSetAt?: string | null;
  activatedAt?: string | null;
  lastLoginAt?: string | null;
}

export interface StaffAppOpenPass {
  id: string;
  gigId: string;
  shiftId?: string;
  feed: "open" | "standby" | "unassigned";
  artist: string;
  arena: string;
  city: string;
  country: string;
  region: string;
  date: string;
  startTime: string;
  endTime: string;
  role: StaffAppRole;
  eligibleCountry: string;
  eligibleRegions: string[];
  eligibleRoles: StaffAppRole[];
  eligibleLevels: StaffAppLevel[];
  publishedAt: string;
  operationsNote: string;
  statusMessage: string;
  imageUrl?: string;
  payRateLabel?: string;
  dressCode?: string;
}

export interface StaffAppManagedGig {
  id: string;
  gigId: string;
  artist: string;
  arena: string;
  city: string;
  country: string;
  region: string;
  date: string;
  startTime: string;
  endTime: string;
  imageUrl?: string;
  statusMessage: string;
  accessEndsOn: string;
  visibleUntil: string;
}

export interface StaffAppScheduledShift {
  id: string;
  gigId: string;
  shiftId?: string;
  artist: string;
  arena: string;
  city: string;
  date: string;
  startTime: string;
  endTime: string;
  role: StaffAppRole;
  status: "Booked" | "Confirmed";
  meetingPoint: string;
  responsibleManager: string;
  practicalNotes: string;
  imageUrl?: string;
  hasRelatedDocuments: boolean;
  threadId?: string;
}

export interface StaffAppAttendanceRecord {
  accountId: string;
  shiftId: string;
  checkedInAt?: string;
  checkedOutAt?: string;
}

export interface StaffAppThreadMessage {
  id: string;
  author: string;
  body: string;
  sentAt: string;
  direction: "incoming" | "outgoing";
  allowReplies: boolean;
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    extension: string;
    url: string;
  }>;
}

export interface StaffAppMessageThread {
  id: string;
  shiftId: string;
  gigId: string;
  shiftTitle: string;
  eventName: string;
  venue: string;
  date: string;
  contactPerson: string;
  latestMessagePreview: string;
  unreadCount: number;
  messages: StaffAppThreadMessage[];
}

export interface StaffAppDocumentLink {
  id: string;
  title: string;
  venue: string;
  date: string;
  role: string;
  kind: "Employment Contract" | "Time Report";
  href: string;
}

export interface StaffAppPayslip {
  id: string;
  monthLabel: string;
  issuedAt: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  grossPayLabel: string;
  totalWorkedHoursLabel: string;
  mealBenefitTaxLabel: string;
  mealBenefitTaxCount: number;
  gigCount: number;
  shiftCount: number;
  summary: string;
  entries: StaffAppPayslipEntry[];
}

export interface StaffAppPayslipEntry {
  id: string;
  gigId: string;
  shiftId: string;
  gigName: string;
  date: string;
  dateLabel: string;
  role: string;
  workedHoursLabel: string;
  hourlyRateLabel: string;
  grossCalculationLabel: string;
  grossPayLabel: string;
  mealBenefitCount: number;
  mealBenefitTaxLabel: string;
}

export interface StaffAppColleague {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  country: string;
  role: string;
  region: string;
  profileImageUrl?: string;
}
