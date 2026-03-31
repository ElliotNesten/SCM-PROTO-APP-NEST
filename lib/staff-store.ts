import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { normalizeHourlyRateOverride } from "@/lib/compensation";
import {
  getPersonProfileView,
  peopleDirectory,
} from "@/data/backend-user-data";
import type { RegistrationStatus, BackendDocumentSummary } from "@/types/backend";
import type { StaffApprovalStatus } from "@/types/scm";
import {
  staffRoleKeys,
  type StaffRoleKey,
  type StoredStaffRoleProfiles,
} from "@/types/staff-role";

export interface StoredStaffProfile {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  regions: string[];
  roles: string[];
  priority: number;
  availability: string;
  approvalStatus: StaffApprovalStatus;
  accessRoleLabel: string;
  registrationStatus: RegistrationStatus;
  registrationLabel: string;
  profileApproved: boolean;
  profileApprovalLabel: string;
  profileImageName: string;
  profileImageUrl?: string;
  bankName: string;
  bankDetails: string;
  personalNumber: string;
  driverLicenseManual: boolean;
  driverLicenseAutomatic: boolean;
  allergies: string;
  roleProfiles: StoredStaffRoleProfiles;
  profileComments: string;
  documents: BackendDocumentSummary[];
  pendingRecords: string[];
}

export interface ArchivedStaffDocumentRecord extends BackendDocumentSummary {
  archivedId: string;
  sourceProfileId: string;
  sourceDisplayName: string;
  sourceCountry: string;
  sourceRegion: string;
  archivedAt: string;
  gigId?: string;
  gigName?: string;
  gigDate?: string;
  shiftId?: string;
  shiftRole?: string;
  documentKind?: string;
}

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-store.json");
const archivedDocumentsStorePath = path.join(
  storeDirectory,
  "old-staff-documents.json",
);

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

function getProfileApprovalLabel(profileApproved: boolean) {
  return profileApproved ? "Approved" : "Pending review";
}

function isProfileImageDocument(document: BackendDocumentSummary) {
  return /(?:^|\/)profile\.[a-z0-9]+$/i.test(document.storageKey);
}

function normalizeRegions(regions: string[]) {
  return Array.from(
    new Set(
      regions
        .map((region) => region.trim())
        .filter(Boolean),
    ),
  );
}

function clampRolePriority(priority: number) {
  if (!Number.isFinite(priority)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(priority)));
}

function createDefaultRoleProfiles(
  legacyRoles: string[] = [],
  legacyPriority = 3,
  legacyComment = "",
) {
  const normalizedLegacyRoles = legacyRoles.map((role) => role.trim()).filter(Boolean);
  const hasOtherRole = normalizedLegacyRoles.some(
    (role) => !staffRoleKeys.includes(role as StaffRoleKey),
  );

  return Object.fromEntries(
    staffRoleKeys.map((roleKey) => [
      roleKey,
      {
        enabled:
          normalizedLegacyRoles.includes(roleKey) ||
          (roleKey === "Other" && hasOtherRole),
        priority: clampRolePriority(legacyPriority),
        comment: normalizedLegacyRoles.includes(roleKey) ? legacyComment : "",
        hourlyRateOverride: null,
      },
    ]),
  ) as StoredStaffRoleProfiles;
}

function normalizeRoleProfiles(
  roleProfiles: Partial<StoredStaffRoleProfiles> | undefined,
  legacyRoles: string[] = [],
  legacyPriority = 3,
  legacyComment = "",
) {
  const defaultProfiles = createDefaultRoleProfiles(
    legacyRoles,
    legacyPriority,
    legacyComment,
  );

  return Object.fromEntries(
    staffRoleKeys.map((roleKey) => {
      const currentProfile = roleProfiles?.[roleKey];

      return [
        roleKey,
        {
          enabled: currentProfile?.enabled ?? defaultProfiles[roleKey].enabled,
          priority: clampRolePriority(
            currentProfile?.priority ?? defaultProfiles[roleKey].priority,
          ),
          comment: currentProfile?.comment?.trim() ?? defaultProfiles[roleKey].comment,
          hourlyRateOverride:
            normalizeHourlyRateOverride(currentProfile?.hourlyRateOverride) ??
            defaultProfiles[roleKey].hourlyRateOverride,
        },
      ];
    }),
  ) as StoredStaffRoleProfiles;
}

function deriveRolesFromProfiles(roleProfiles: StoredStaffRoleProfiles) {
  return staffRoleKeys.filter((roleKey) => roleProfiles[roleKey].enabled);
}

function derivePriorityFromProfiles(
  roleProfiles: StoredStaffRoleProfiles,
  fallbackPriority: number,
) {
  const enabledPriorities = staffRoleKeys
    .filter((roleKey) => roleProfiles[roleKey].enabled)
    .map((roleKey) => roleProfiles[roleKey].priority);

  if (enabledPriorities.length === 0) {
    return clampRolePriority(fallbackPriority);
  }

  return Math.min(...enabledPriorities);
}

function deriveProfileCommentsFromProfiles(
  roleProfiles: StoredStaffRoleProfiles,
  fallbackComment: string,
) {
  const commentLines = staffRoleKeys
    .filter((roleKey) => roleProfiles[roleKey].comment.trim().length > 0)
    .map((roleKey) => `[${roleKey}] ${roleProfiles[roleKey].comment.trim()}`);

  if (commentLines.length === 0) {
    return fallbackComment;
  }

  return commentLines.join("\n");
}

function normalizeStoredStaffProfile(profile: StoredStaffProfile): StoredStaffProfile {
  const normalizedRegions = normalizeRegions(
    profile.regions && profile.regions.length > 0
      ? profile.regions
      : [profile.region],
  );
  const normalizedRoleProfiles = normalizeRoleProfiles(
    profile.roleProfiles,
    profile.roles,
    profile.priority,
    profile.profileComments,
  );

  return {
    ...profile,
    region: normalizedRegions[0] ?? "",
    regions: normalizedRegions,
    roles: deriveRolesFromProfiles(normalizedRoleProfiles),
    priority: derivePriorityFromProfiles(normalizedRoleProfiles, profile.priority),
    bankName: profile.bankName ?? "",
    driverLicenseManual: profile.driverLicenseManual ?? false,
    driverLicenseAutomatic: profile.driverLicenseAutomatic ?? false,
    allergies: profile.allergies ?? "",
    roleProfiles: normalizedRoleProfiles,
    profileComments: deriveProfileCommentsFromProfiles(
      normalizedRoleProfiles,
      profile.profileComments ?? "",
    ),
    documents: profile.documents.filter((document) => !isProfileImageDocument(document)),
    profileImageUrl: profile.profileImageUrl,
  };
}

function createSeedStaffProfiles(): StoredStaffProfile[] {
  return peopleDirectory.map((person) => {
    const profile = getPersonProfileView(person.id);

    return normalizeStoredStaffProfile({
      id: person.id,
      displayName: profile.displayName,
      email: profile.email,
      phone: profile.phone,
      country: profile.country,
      region: profile.region,
      regions: [profile.region],
      roles: [...person.roles],
      priority: person.priority,
      availability: person.availability,
      approvalStatus: person.approvalStatus,
      accessRoleLabel: person.accessRoleLabel,
      registrationStatus: person.registrationStatus,
      registrationLabel: profile.registrationLabel,
      profileApproved: profile.profileApproved,
      profileApprovalLabel: profile.profileApprovalLabel,
      profileImageName: profile.profilePhotoName,
      profileImageUrl: undefined,
      bankName: "",
      bankDetails: profile.bankDetailsLabel,
      personalNumber: profile.personalNumberLabel,
      driverLicenseManual: false,
      driverLicenseAutomatic: false,
      allergies: "",
      roleProfiles: createDefaultRoleProfiles(
        person.roles,
        person.priority,
        profile.profileCommentsLabel,
      ),
      profileComments: profile.profileCommentsLabel,
      documents: profile.documents,
      pendingRecords: [...profile.pendingRecords],
    });
  });
}

async function ensureStaffStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify(createSeedStaffProfiles(), null, 2),
      "utf8",
    );
  }
}

async function ensureArchivedDocumentsStore() {
  try {
    await fs.access(archivedDocumentsStorePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(archivedDocumentsStorePath, JSON.stringify([], null, 2), "utf8");
  }
}

async function readStaffStore() {
  await ensureStaffStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as StoredStaffProfile[];
  return parsed.map(normalizeStoredStaffProfile);
}

async function writeStaffStore(profiles: StoredStaffProfile[]) {
  await fs.writeFile(storePath, JSON.stringify(profiles, null, 2), "utf8");
}

async function readArchivedDocumentsStore() {
  await ensureArchivedDocumentsStore();
  const raw = await fs.readFile(archivedDocumentsStorePath, "utf8");
  return JSON.parse(raw) as ArchivedStaffDocumentRecord[];
}

async function writeArchivedDocumentsStore(records: ArchivedStaffDocumentRecord[]) {
  await fs.writeFile(archivedDocumentsStorePath, JSON.stringify(records, null, 2), "utf8");
}

export async function getAllStoredStaffProfiles() {
  return readStaffStore();
}

export async function getArchivedStaffDocuments() {
  return readArchivedDocumentsStore();
}

export async function getStoredStaffProfileById(personId: string) {
  const profiles = await readStaffStore();
  return profiles.find((profile) => profile.id === personId);
}

export async function getStoredStaffProfileByEmail(email: string) {
  const profiles = await readStaffStore();
  return profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase()) ?? null;
}

type NewStaffProfileInput = {
  displayName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  regions?: string[];
  roles: string[];
  priority: number;
  availability: string;
  approvalStatus: StaffApprovalStatus;
  accessRoleLabel: string;
  registrationStatus: RegistrationStatus;
  profileApproved: boolean;
  bankName?: string;
  bankDetails: string;
  personalNumber: string;
  profileImageName?: string;
  profileImageUrl?: string;
  driverLicenseManual?: boolean;
  driverLicenseAutomatic?: boolean;
  allergies?: string;
  roleProfiles?: Partial<StoredStaffRoleProfiles>;
  profileComments: string;
  pendingRecords: string[];
};

type StaffProfileUpdate = Partial<
  Pick<
    StoredStaffProfile,
    | "displayName"
    | "email"
    | "phone"
    | "country"
    | "region"
    | "regions"
    | "roles"
    | "priority"
    | "availability"
    | "approvalStatus"
    | "accessRoleLabel"
    | "registrationStatus"
    | "profileApproved"
    | "profileImageName"
    | "profileImageUrl"
    | "bankName"
    | "bankDetails"
    | "personalNumber"
    | "driverLicenseManual"
    | "driverLicenseAutomatic"
    | "allergies"
    | "roleProfiles"
    | "profileComments"
    | "pendingRecords"
  >
>;

export async function updateStoredStaffProfile(
  personId: string,
  updates: StaffProfileUpdate,
) {
  const profiles = await readStaffStore();
  const profileIndex = profiles.findIndex((profile) => profile.id === personId);

  if (profileIndex === -1) {
    return null;
  }

  const existingProfile = profiles[profileIndex];
  const nextRegistrationStatus =
    updates.registrationStatus ?? existingProfile.registrationStatus;
  const nextProfileApproved =
    updates.profileApproved ?? existingProfile.profileApproved;
  const requestedRegions =
    updates.regions !== undefined ? normalizeRegions(updates.regions) : undefined;
  const existingRegions = normalizeRegions(existingProfile.regions ?? [existingProfile.region]);
  const nextRegions = requestedRegions ?? existingRegions;
  const nextRegion =
    updates.region !== undefined
      ? updates.region.trim()
      : nextRegions[0] ?? existingProfile.region;
  const nextRoleProfiles = normalizeRoleProfiles(
    updates.roleProfiles ?? existingProfile.roleProfiles,
    updates.roles ?? existingProfile.roles,
    updates.priority ?? existingProfile.priority,
    updates.profileComments ?? existingProfile.profileComments,
  );

  const updatedProfile: StoredStaffProfile = {
    ...existingProfile,
    ...updates,
    region: nextRegion,
    regions: nextRegions,
    roles: deriveRolesFromProfiles(nextRoleProfiles),
    priority: derivePriorityFromProfiles(
      nextRoleProfiles,
      updates.priority ?? existingProfile.priority,
    ),
    pendingRecords: updates.pendingRecords
      ? [...updates.pendingRecords]
      : existingProfile.pendingRecords,
    approvalStatus:
      updates.approvalStatus ??
      (updates.registrationStatus
        ? mapRegistrationStatusToApprovalStatus(updates.registrationStatus)
        : existingProfile.approvalStatus),
    registrationStatus: nextRegistrationStatus,
    registrationLabel: getRegistrationLabel(nextRegistrationStatus),
    profileApproved: nextProfileApproved,
    profileApprovalLabel: getProfileApprovalLabel(nextProfileApproved),
    bankName: updates.bankName ?? existingProfile.bankName ?? "",
    driverLicenseManual:
      updates.driverLicenseManual ?? existingProfile.driverLicenseManual ?? false,
    driverLicenseAutomatic:
      updates.driverLicenseAutomatic ?? existingProfile.driverLicenseAutomatic ?? false,
    allergies: updates.allergies ?? existingProfile.allergies ?? "",
    roleProfiles: nextRoleProfiles,
    profileComments: deriveProfileCommentsFromProfiles(
      nextRoleProfiles,
      updates.profileComments ?? existingProfile.profileComments,
    ),
  };

  profiles[profileIndex] = normalizeStoredStaffProfile(updatedProfile);
  await writeStaffStore(profiles);

  return normalizeStoredStaffProfile(updatedProfile);
}

export async function updateStoredStaffImage(
  personId: string,
  image: { profileImageName: string; profileImageUrl: string },
) {
  return updateStoredStaffProfile(personId, image);
}

export async function createStoredStaffProfile(input: NewStaffProfileInput) {
  const profiles = await readStaffStore();
  const profileId = `staff-${randomUUID().slice(0, 8)}`;
  const normalizedProfile = normalizeStoredStaffProfile({
    id: profileId,
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    country: input.country,
    region: input.region,
    regions: normalizeRegions(input.regions ?? [input.region]),
    roles: [...input.roles],
    priority: input.priority,
    availability: input.availability,
    approvalStatus: input.approvalStatus,
    accessRoleLabel: input.accessRoleLabel,
    registrationStatus: input.registrationStatus,
    registrationLabel: getRegistrationLabel(input.registrationStatus),
    profileApproved: input.profileApproved,
    profileApprovalLabel: getProfileApprovalLabel(input.profileApproved),
    profileImageName: input.profileImageName ?? "",
    profileImageUrl: input.profileImageUrl,
    bankName: input.bankName ?? "",
    bankDetails: input.bankDetails,
    personalNumber: input.personalNumber,
    driverLicenseManual: input.driverLicenseManual ?? false,
    driverLicenseAutomatic: input.driverLicenseAutomatic ?? false,
    allergies: input.allergies ?? "",
    roleProfiles: normalizeRoleProfiles(
      input.roleProfiles,
      input.roles,
      input.priority,
      input.profileComments,
    ),
    profileComments: input.profileComments,
    documents: [],
    pendingRecords: [...input.pendingRecords],
  });

  profiles.unshift(normalizedProfile);
  await writeStaffStore(profiles);

  return normalizedProfile;
}

export async function deleteStoredStaffProfile(personId: string) {
  const profiles = await readStaffStore();
  const profileIndex = profiles.findIndex((profile) => profile.id === personId);

  if (profileIndex === -1) {
    return null;
  }

  const profile = profiles[profileIndex];
  const archivedAt = new Date().toISOString();
  const { getStoredStaffDocuments } = await import("@/lib/staff-document-store");
  const [archivedDocuments, generatedDocuments] = await Promise.all([
    readArchivedDocumentsStore(),
    getStoredStaffDocuments(personId),
  ]);

  const archivedProfileDocuments: ArchivedStaffDocumentRecord[] = profile.documents.map(
    (document) => ({
      ...document,
      archivedId: `old-doc-${randomUUID().slice(0, 8)}`,
      sourceProfileId: profile.id,
      sourceDisplayName: profile.displayName,
      sourceCountry: profile.country,
      sourceRegion: profile.region,
      archivedAt,
    }),
  );

  const archivedGeneratedDocuments: ArchivedStaffDocumentRecord[] = generatedDocuments.map(
    (document) => ({
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      storageBucket: "generated-pdf",
      storageKey: `staff-generated/${document.userId}/${document.id}.pdf`,
      uploadedByUserId: document.userId,
      archivedId: `old-doc-${randomUUID().slice(0, 8)}`,
      sourceProfileId: profile.id,
      sourceDisplayName: profile.displayName,
      sourceCountry: profile.country,
      sourceRegion: profile.region,
      archivedAt,
      gigId: document.gigId,
      gigName: document.gigName,
      gigDate: document.gigDate,
      shiftId: document.shiftId,
      shiftRole: document.shiftRole,
      documentKind: document.documentKind,
    }),
  );

  profiles.splice(profileIndex, 1);

  await Promise.all([
    writeStaffStore(profiles),
    writeArchivedDocumentsStore([
      ...archivedProfileDocuments,
      ...archivedGeneratedDocuments,
      ...archivedDocuments,
    ]),
  ]);

  return {
    deletedProfile: profile,
    archivedDocumentCount:
      archivedProfileDocuments.length + archivedGeneratedDocuments.length,
  };
}
