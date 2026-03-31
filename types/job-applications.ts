export const staffApplicationCountryOptions = [
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
] as const;

export const swedenStaffApplicationRegionOptions = [
  "Stockholm",
  "Gothenburg",
  "Malmo",
] as const;

export type StaffApplicationCountry = (typeof staffApplicationCountryOptions)[number];
export type SwedenStaffApplicationRegion =
  (typeof swedenStaffApplicationRegionOptions)[number];

export type StaffApplicationStatus = "pending" | "approved" | "rejected";
export type StaffApplicationApprovalEmailStatus =
  | "not_requested"
  | "pending"
  | "sent"
  | "failed";

export interface StoredStaffApplication {
  id: string;
  status: StaffApplicationStatus;
  profileImageName: string;
  profileImageUrl: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByProfileId: string | null;
  reviewedByName: string | null;
  rejectionReason: string | null;
  convertedStaffProfileId: string | null;
  approvalEmailStatus: StaffApplicationApprovalEmailStatus;
  approvalEmailLastAttemptAt: string | null;
  approvalEmailError: string | null;
  passwordSetupTokenId: string | null;
}

export interface PasswordSetupTokenRecord {
  id: string;
  email: string;
  staffProfileId: string;
  staffAppAccountId: string;
  applicationId: string | null;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  invalidatedAt: string | null;
}

export type PasswordSetupTokenVerificationState =
  | "valid"
  | "expired"
  | "consumed"
  | "invalidated"
  | "missing";

export interface PasswordSetupTokenVerificationResult {
  state: PasswordSetupTokenVerificationState;
  record: PasswordSetupTokenRecord | null;
}

export interface StaffOnboardingRecord {
  id: string;
  staffProfileId: string;
  staffAppAccountId: string;
  personalNumber: string;
  bankName: string;
  bankAccount: string;
  allergies: string;
  driverLicenseManual: boolean;
  driverLicenseAutomatic: boolean;
  savedAt: string;
  updatedAt: string;
  welcomeAcknowledgedAt: string | null;
}

export interface StaffApplicationApprovalEmailTemplate {
  id: "approvedApplication";
  label: string;
  description: string;
  subject: string;
  preheader: string;
  headline: string;
  intro: string;
  body: string;
  ctaLabel: string;
  expiryNotice: string;
  helpText: string;
  signature: string;
  footerText: string;
  supportEmail: string;
}
