import type { StaffApprovalStatus, StaffMember } from "@/types/scm";
import type {
  BackendDocumentSummary,
  BackendEmployeeProfile,
  BackendUserResponse,
  BackendUserRoleAssignment,
  EmployeeRoleCode,
  RegistrationStatus,
} from "@/types/backend";

type StaffingUiMeta = {
  roles: string[];
  priority: number;
  availability: string;
};

export interface PeopleDirectoryEntry extends StaffMember {
  firstName: string;
  lastName: string;
  registrationStatus: RegistrationStatus;
  accessRoleLabel: string;
  profileApproved: boolean;
}

export interface CurrentUserSummary {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  roleLabel: string;
}

export interface CurrentUserProfileView {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  roleLabel: string;
  registrationStatus: RegistrationStatus;
  registrationLabel: string;
  profileApproved: boolean;
  profileApprovalLabel: string;
  profilePhotoName: string;
  bankDetailsLabel: string;
  personalNumberLabel: string;
  profileCommentsLabel: string;
  documents: BackendDocumentSummary[];
  pendingRecords: string[];
}

const currentUserId = "office-1";

const backendUsers: BackendUserResponse[] = [
  {
    id: currentUserId,
    email: "edwin.jones@scm.se",
    firstName: "Edwin",
    lastName: "Jones",
    phoneNumber: "+46701234567",
    status: "ACTIVATED",
    createdAt: "2026-01-05T08:15:00Z",
    updatedAt: "2026-03-24T17:40:00Z",
  },
  {
    id: "staff-1",
    email: "sandra@scm.se",
    firstName: "Sandra",
    lastName: "Munoz",
    phoneNumber: "+46701111111",
    status: "APPROVED",
    createdAt: "2026-01-11T09:20:00Z",
    updatedAt: "2026-03-18T11:10:00Z",
  },
  {
    id: "staff-2",
    email: "albin.nyberg@scm.se",
    firstName: "Albin",
    lastName: "Nyberg",
    phoneNumber: "+46702222222",
    status: "APPROVED",
    createdAt: "2026-01-12T10:20:00Z",
    updatedAt: "2026-03-19T08:40:00Z",
  },
  {
    id: "staff-3",
    email: "emilio@scm.se",
    firstName: "Emilio",
    lastName: "Ribba",
    phoneNumber: "+46703333333",
    status: "APPROVED",
    createdAt: "2026-01-13T10:40:00Z",
    updatedAt: "2026-03-20T07:55:00Z",
  },
  {
    id: "staff-4",
    email: "daniel@scm.se",
    firstName: "Daniel",
    lastName: "Boss",
    phoneNumber: "+46704444444",
    status: "APPROVED",
    createdAt: "2026-01-14T13:10:00Z",
    updatedAt: "2026-03-20T15:25:00Z",
  },
  {
    id: "staff-5",
    email: "julia@scm.se",
    firstName: "Julia",
    lastName: "Nord",
    phoneNumber: "+46705555555",
    status: "APPROVED",
    createdAt: "2026-01-15T14:35:00Z",
    updatedAt: "2026-03-14T09:45:00Z",
  },
  {
    id: "staff-6",
    email: "noah@scm.se",
    firstName: "Noah",
    lastName: "Berg",
    phoneNumber: "+46706666666",
    status: "APPROVED",
    createdAt: "2026-01-18T08:55:00Z",
    updatedAt: "2026-03-22T16:15:00Z",
  },
  {
    id: "staff-7",
    email: "sara@scm.se",
    firstName: "Sara",
    lastName: "Holm",
    phoneNumber: "+46707777777",
    status: "APPROVED",
    createdAt: "2026-01-21T07:50:00Z",
    updatedAt: "2026-03-12T13:20:00Z",
  },
  {
    id: "staff-8",
    email: "leo@scm.se",
    firstName: "Leo",
    lastName: "Storm",
    phoneNumber: "+46708888888",
    status: "APPROVED",
    createdAt: "2026-01-25T15:00:00Z",
    updatedAt: "2026-03-21T11:30:00Z",
  },
  {
    id: "staff-9",
    email: "maja@scm.se",
    firstName: "Maja",
    lastName: "Ek",
    phoneNumber: "+46709999999",
    status: "APPROVED",
    createdAt: "2026-02-01T16:20:00Z",
    updatedAt: "2026-03-23T10:45:00Z",
  },
  {
    id: "staff-10",
    email: "oliver@scm.se",
    firstName: "Oliver",
    lastName: "Dane",
    phoneNumber: "+46701010101",
    status: "PENDING",
    createdAt: "2026-03-02T17:40:00Z",
    updatedAt: "2026-03-25T08:05:00Z",
  },
];

const employeeProfiles: BackendEmployeeProfile[] = [
  {
    userId: currentUserId,
    mainCountryName: "Sweden",
    mainRegionName: "Stockholm",
    bankAccountClearingNumberMasked: "8129",
    bankAccountNumberMasked: "**** 4219",
    personalNumberMasked: "********-4312",
    profilePhotoDocumentId: "doc-profile-edwin",
    profileApproved: true,
    profileCommentCount: 2,
  },
  {
    userId: "staff-1",
    mainCountryName: "Sweden",
    mainRegionName: "Stockholm",
    bankAccountClearingNumberMasked: "8234",
    bankAccountNumberMasked: "**** 1001",
    personalNumberMasked: "********-1101",
    profilePhotoDocumentId: "doc-profile-sandra",
    profileApproved: true,
    profileCommentCount: 0,
  },
  {
    userId: "staff-2",
    mainCountryName: "Sweden",
    mainRegionName: "Stockholm",
    bankAccountClearingNumberMasked: "8234",
    bankAccountNumberMasked: "**** 1002",
    personalNumberMasked: "********-1102",
    profilePhotoDocumentId: "doc-profile-anton",
    profileApproved: true,
    profileCommentCount: 1,
  },
  {
    userId: "staff-3",
    mainCountryName: "Sweden",
    mainRegionName: "West",
    bankAccountClearingNumberMasked: "8341",
    bankAccountNumberMasked: "**** 1003",
    personalNumberMasked: "********-1103",
    profilePhotoDocumentId: "doc-profile-emilio",
    profileApproved: true,
    profileCommentCount: 0,
  },
  {
    userId: "staff-4",
    mainCountryName: "Sweden",
    mainRegionName: "South",
    bankAccountClearingNumberMasked: "8450",
    bankAccountNumberMasked: "**** 1004",
    personalNumberMasked: "********-1104",
    profilePhotoDocumentId: "doc-profile-daniel",
    profileApproved: true,
    profileCommentCount: 0,
  },
  {
    userId: "staff-5",
    mainCountryName: "Sweden",
    mainRegionName: "Stockholm",
    bankAccountClearingNumberMasked: "8450",
    bankAccountNumberMasked: "**** 1005",
    personalNumberMasked: "********-1105",
    profilePhotoDocumentId: "doc-profile-julia",
    profileApproved: true,
    profileCommentCount: 1,
  },
  {
    userId: "staff-6",
    mainCountryName: "Sweden",
    mainRegionName: "West",
    bankAccountClearingNumberMasked: "8129",
    bankAccountNumberMasked: "**** 1006",
    personalNumberMasked: "********-1106",
    profilePhotoDocumentId: "doc-profile-noah",
    profileApproved: true,
    profileCommentCount: 0,
  },
  {
    userId: "staff-7",
    mainCountryName: "Sweden",
    mainRegionName: "West",
    bankAccountClearingNumberMasked: "8129",
    bankAccountNumberMasked: "**** 1007",
    personalNumberMasked: "********-1107",
    profilePhotoDocumentId: "doc-profile-sara",
    profileApproved: true,
    profileCommentCount: 0,
  },
  {
    userId: "staff-8",
    mainCountryName: "Denmark",
    mainRegionName: "Capital",
    bankAccountClearingNumberMasked: "7562",
    bankAccountNumberMasked: "**** 1008",
    personalNumberMasked: "********-1108",
    profilePhotoDocumentId: "doc-profile-leo",
    profileApproved: true,
    profileCommentCount: 0,
  },
  {
    userId: "staff-9",
    mainCountryName: "Norway",
    mainRegionName: "Oslo",
    bankAccountClearingNumberMasked: "7021",
    bankAccountNumberMasked: "**** 1009",
    personalNumberMasked: "********-1109",
    profilePhotoDocumentId: "doc-profile-maja",
    profileApproved: true,
    profileCommentCount: 0,
  },
  {
    userId: "staff-10",
    mainCountryName: "Norway",
    mainRegionName: "Oslo",
    bankAccountClearingNumberMasked: "7021",
    bankAccountNumberMasked: "**** 1010",
    personalNumberMasked: "********-1110",
    profilePhotoDocumentId: "doc-profile-oliver",
    profileApproved: false,
    profileCommentCount: 1,
  },
];

const documents: BackendDocumentSummary[] = [
  {
    id: "doc-profile-edwin",
    fileName: "edwin-jones-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 184320,
    storageBucket: "profile-documents",
    storageKey: "profiles/edwin-jones/profile.jpg",
    uploadedByUserId: currentUserId,
  },
  {
    id: "doc-profile-sandra",
    fileName: "sandra-munoz-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 160240,
    storageBucket: "profile-documents",
    storageKey: "profiles/sandra-munoz/profile.jpg",
    uploadedByUserId: "staff-1",
  },
  {
    id: "doc-profile-anton",
    fileName: "albin-nyberg-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 158900,
    storageBucket: "profile-documents",
    storageKey: "profiles/albin-nyberg/profile.jpg",
    uploadedByUserId: "staff-2",
  },
  {
    id: "doc-profile-emilio",
    fileName: "emilio-ribba-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 164800,
    storageBucket: "profile-documents",
    storageKey: "profiles/emilio-ribba/profile.jpg",
    uploadedByUserId: "staff-3",
  },
  {
    id: "doc-profile-daniel",
    fileName: "daniel-boss-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 167210,
    storageBucket: "profile-documents",
    storageKey: "profiles/daniel-boss/profile.jpg",
    uploadedByUserId: "staff-4",
  },
  {
    id: "doc-profile-julia",
    fileName: "julia-nord-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 171440,
    storageBucket: "profile-documents",
    storageKey: "profiles/julia-nord/profile.jpg",
    uploadedByUserId: "staff-5",
  },
  {
    id: "doc-profile-noah",
    fileName: "noah-berg-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 162700,
    storageBucket: "profile-documents",
    storageKey: "profiles/noah-berg/profile.jpg",
    uploadedByUserId: "staff-6",
  },
  {
    id: "doc-profile-sara",
    fileName: "sara-holm-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 165320,
    storageBucket: "profile-documents",
    storageKey: "profiles/sara-holm/profile.jpg",
    uploadedByUserId: "staff-7",
  },
  {
    id: "doc-profile-leo",
    fileName: "leo-storm-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 159670,
    storageBucket: "profile-documents",
    storageKey: "profiles/leo-storm/profile.jpg",
    uploadedByUserId: "staff-8",
  },
  {
    id: "doc-profile-maja",
    fileName: "maja-ek-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 163980,
    storageBucket: "profile-documents",
    storageKey: "profiles/maja-ek/profile.jpg",
    uploadedByUserId: "staff-9",
  },
  {
    id: "doc-profile-oliver",
    fileName: "oliver-dane-profile.jpg",
    fileType: "image/jpeg",
    fileSize: 157500,
    storageBucket: "profile-documents",
    storageKey: "profiles/oliver-dane/profile.jpg",
    uploadedByUserId: "staff-10",
  },
  {
    id: "doc-tax-edwin",
    fileName: "edwin-jones-tax-card.pdf",
    fileType: "application/pdf",
    fileSize: 248320,
    storageBucket: "profile-documents",
    storageKey: "profiles/edwin-jones/tax-card.pdf",
    uploadedByUserId: currentUserId,
  },
  {
    id: "doc-bank-edwin",
    fileName: "edwin-jones-bank-proof.pdf",
    fileType: "application/pdf",
    fileSize: 292110,
    storageBucket: "profile-documents",
    storageKey: "profiles/edwin-jones/bank-proof.pdf",
    uploadedByUserId: currentUserId,
  },
];

const roleAssignments: BackendUserRoleAssignment[] = [
  {
    userId: currentUserId,
    roleName: "Super Admin",
    employeeRoleCode: "SUPER_ADMIN",
    active: true,
  },
  ...[
    "staff-1",
    "staff-2",
    "staff-3",
    "staff-4",
    "staff-5",
    "staff-6",
    "staff-7",
    "staff-8",
    "staff-9",
    "staff-10",
  ].map((userId) => ({
    userId,
    roleName: "Field staff",
    employeeRoleCode: "STAFF" as EmployeeRoleCode,
    active: true,
  })),
];

const staffingMetadata: Record<string, StaffingUiMeta> = {
  "staff-1": {
    roles: ["Stand Leader", "Seller"],
    priority: 1,
    availability: "Available",
  },
  "staff-2": {
    roles: ["Stand Leader", "Runner"],
    priority: 1,
    availability: "Available",
  },
  "staff-3": {
    roles: ["Seller"],
    priority: 2,
    availability: "Available",
  },
  "staff-4": {
    roles: ["Seller", "Runner"],
    priority: 2,
    availability: "Available",
  },
  "staff-5": {
    roles: ["Seller"],
    priority: 3,
    availability: "Limited",
  },
  "staff-6": {
    roles: ["Runner"],
    priority: 2,
    availability: "Available",
  },
  "staff-7": {
    roles: ["Stand Leader"],
    priority: 1,
    availability: "Available",
  },
  "staff-8": {
    roles: ["Seller", "Runner"],
    priority: 2,
    availability: "Busy",
  },
  "staff-9": {
    roles: ["Runner"],
    priority: 3,
    availability: "Available",
  },
  "staff-10": {
    roles: ["Seller"],
    priority: 2,
    availability: "Available",
  },
};

const workforceUserIds = Object.keys(staffingMetadata);
const usersById = new Map(backendUsers.map((user) => [user.id, user]));
const profilesByUserId = new Map(employeeProfiles.map((profile) => [profile.userId, profile]));
const documentsById = new Map(documents.map((document) => [document.id, document]));

function mapRegistrationStatusToApprovalStatus(
  status: RegistrationStatus,
): StaffApprovalStatus {
  if (status === "APPROVED" || status === "ACTIVATED") {
    return "Approved";
  }

  if (status === "PENDING") {
    return "Applicant";
  }

  return "Archived";
}

function getRegistrationLabel(status: RegistrationStatus) {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "ACTIVATED":
      return "Activated";
    case "PENDING":
      return "Pending";
    case "BLOCKED":
      return "Blocked";
    case "DEACTIVATED":
      return "Deactivated";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

function getPrimaryRoleLabel(userId: string) {
  const activeRoles = roleAssignments.filter((role) => role.userId === userId && role.active);
  if (activeRoles.length === 0) {
    return "Staff";
  }

  return activeRoles
    .slice()
    .sort((left, right) => getRoleWeight(right.employeeRoleCode) - getRoleWeight(left.employeeRoleCode))[0]
    .roleName;
}

function getRoleWeight(roleCode: EmployeeRoleCode) {
  switch (roleCode) {
    case "SUPER_ADMIN":
      return 5;
    case "OFFICE_PERSONNEL":
      return 4;
    case "REGION_MANAGER":
      return 3;
    case "TEMPORARY_GIG_MANAGER":
      return 2;
    case "STAFF":
      return 1;
    default:
      return 0;
  }
}

function toDisplayName(user: BackendUserResponse) {
  return `${user.firstName} ${user.lastName}`;
}

function toInitials(user: BackendUserResponse) {
  return `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
}

function toDisplayPhone(phoneNumber: string | null) {
  if (!phoneNumber) {
    return "Not added";
  }

  if (phoneNumber.startsWith("+46") && phoneNumber.length === 12) {
    return `+46 ${phoneNumber.slice(3, 5)} ${phoneNumber.slice(5, 8)} ${phoneNumber.slice(8)}`;
  }

  return phoneNumber;
}

function getProfilePhotoName(userId: string) {
  const profile = profilesByUserId.get(userId);
  if (!profile?.profilePhotoDocumentId) {
    return "Missing";
  }

  return documentsById.get(profile.profilePhotoDocumentId)?.fileName ?? "Missing";
}

function toPeopleEntry(userId: string): PeopleDirectoryEntry {
  const user = usersById.get(userId);
  const profile = profilesByUserId.get(userId);
  const uiMeta = staffingMetadata[userId];

  if (!user || !profile || !uiMeta) {
    throw new Error(`Missing integrated user data for ${userId}`);
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: toDisplayName(user),
    email: user.email,
    phone: toDisplayPhone(user.phoneNumber),
    country: profile.mainCountryName ?? "Unassigned country",
    region: profile.mainRegionName ?? "Unassigned region",
    roles: uiMeta.roles,
    priority: uiMeta.priority,
    availability: uiMeta.availability,
    approvalStatus: mapRegistrationStatusToApprovalStatus(user.status),
    registrationStatus: user.status,
    accessRoleLabel: getPrimaryRoleLabel(user.id),
    profileApproved: profile.profileApproved,
  };
}

export const peopleDirectory: PeopleDirectoryEntry[] = workforceUserIds.map(toPeopleEntry);

export const staffDirectory: StaffMember[] = peopleDirectory.map(
  ({
    id,
    name,
    country,
    region,
    email,
    phone,
    roles,
    priority,
    availability,
    approvalStatus,
  }) => ({
    id,
    name,
    country,
    region,
    email,
    phone,
    roles,
    priority,
    availability,
    approvalStatus,
  }),
);

export function getPersonDirectoryEntryById(personId: string) {
  return peopleDirectory.find((person) => person.id === personId);
}

export function getCurrentUserSummary(): CurrentUserSummary {
  const user = usersById.get(currentUserId);
  if (!user) {
    throw new Error("Missing current user");
  }

  return {
    id: user.id,
    email: user.email,
    displayName: toDisplayName(user),
    initials: toInitials(user),
    roleLabel: getPrimaryRoleLabel(user.id),
  };
}

function buildProfileView(userId: string): CurrentUserProfileView {
  const user = usersById.get(userId);
  const profile = profilesByUserId.get(userId);

  if (!user || !profile) {
    throw new Error(`Missing user profile for ${userId}`);
  }

  const currentUserDocuments = documents.filter((document) => document.uploadedByUserId === userId);

  return {
    id: user.id,
    displayName: toDisplayName(user),
    email: user.email,
    phone: toDisplayPhone(user.phoneNumber),
    country: profile.mainCountryName ?? "Unassigned country",
    region: profile.mainRegionName ?? "Unassigned region",
    roleLabel: getPrimaryRoleLabel(user.id),
    registrationStatus: user.status,
    registrationLabel: getRegistrationLabel(user.status),
    profileApproved: profile.profileApproved,
    profileApprovalLabel: profile.profileApproved ? "Approved" : "Pending review",
    profilePhotoName: getProfilePhotoName(user.id),
    bankDetailsLabel: `${profile.bankAccountClearingNumberMasked} | ${profile.bankAccountNumberMasked}`,
    personalNumberLabel: profile.personalNumberMasked,
    profileCommentsLabel:
      profile.profileCommentCount === 0
        ? "No profile comments"
        : `${profile.profileCommentCount} profile comments`,
    documents: currentUserDocuments,
    pendingRecords: [
      "Driver license",
      "Allergies",
      "Policy confirmations",
      "Own bookings",
      "Own contracts",
      "Own payslips",
      "Own completed gigs",
    ],
  };
}

export function getCurrentUserProfileView(): CurrentUserProfileView {
  return buildProfileView(currentUserId);
}

export function getPersonProfileView(personId: string) {
  return buildProfileView(personId);
}

export function getProjectManagerOptions(currentDisplayName?: string) {
  return [
    ...new Set([
      ...(currentDisplayName?.trim() ? [currentDisplayName.trim()] : []),
      ...peopleDirectory.map((person) => person.name),
    ]),
  ].sort((left, right) => left.localeCompare(right, "en"));
}
