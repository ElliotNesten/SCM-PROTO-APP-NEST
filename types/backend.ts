export type RegistrationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED"
  | "ACTIVATED"
  | "DEACTIVATED";

export type EmployeeRoleCode =
  | "SUPER_ADMIN"
  | "OFFICE_PERSONNEL"
  | "REGION_MANAGER"
  | "TEMPORARY_GIG_MANAGER"
  | "STAFF";

export interface BackendUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  status: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BackendDocumentSummary {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageBucket: string;
  storageKey: string;
  uploadedByUserId: string;
}

export interface BackendEmployeeProfile {
  userId: string;
  mainCountryName: string | null;
  mainRegionName: string | null;
  bankAccountClearingNumberMasked: string;
  bankAccountNumberMasked: string;
  personalNumberMasked: string;
  profilePhotoDocumentId: string | null;
  profileApproved: boolean;
  profileCommentCount: number;
}

export interface BackendUserRoleAssignment {
  userId: string;
  roleName: string;
  employeeRoleCode: EmployeeRoleCode;
  active: boolean;
}
