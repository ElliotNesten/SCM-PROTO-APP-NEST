import { randomUUID } from "node:crypto";
import path from "node:path";

import { ensureJsonFile, readJsonFile, writeJsonFile } from "@/lib/json-file-store";
import { normalizeHourlyRateOverride } from "@/lib/compensation";
import {
  ensureProductionStorageSchema,
  getPostgresClient,
  isDatabaseConfigured,
  parseJsonValue,
  serializeJson,
} from "@/lib/postgres";
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

type StaffProfileRow = {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  regions_json: string;
  roles_json: string;
  priority: number;
  availability: string;
  approval_status: StaffApprovalStatus;
  access_role_label: string;
  registration_status: RegistrationStatus;
  registration_label: string;
  profile_approved: boolean;
  profile_approval_label: string;
  profile_image_name: string;
  profile_image_url: string | null;
  bank_name: string;
  bank_details: string;
  personal_number: string;
  driver_license_manual: boolean;
  driver_license_automatic: boolean;
  allergies: string;
  role_profiles_json: string;
  profile_comments: string;
  documents_json: string;
  pending_records_json: string;
  is_deleted: boolean;
};

type ArchivedStaffDocumentRow = {
  archived_id: string;
  source_profile_id: string;
  archived_at: string;
  record_json: string;
};

type StaffProfileDatabaseLookupResult =
  | { status: "missing" }
  | { status: "deleted" }
  | { status: "found"; profile: StoredStaffProfile };

function logStaffStoreFallback(action: string, error: unknown) {
  console.error(`[staff-store] ${action} failed. Falling back to bundled staff data.`, error);
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

function mapStaffProfileRow(row: StaffProfileRow): StoredStaffProfile {
  return normalizeStoredStaffProfile({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    region: row.region,
    regions: parseJsonValue<string[]>(row.regions_json, [row.region]),
    roles: parseJsonValue<string[]>(row.roles_json, []),
    priority: row.priority,
    availability: row.availability,
    approvalStatus: row.approval_status,
    accessRoleLabel: row.access_role_label,
    registrationStatus: row.registration_status,
    registrationLabel: row.registration_label,
    profileApproved: row.profile_approved,
    profileApprovalLabel: row.profile_approval_label,
    profileImageName: row.profile_image_name,
    profileImageUrl: row.profile_image_url ?? undefined,
    bankName: row.bank_name,
    bankDetails: row.bank_details,
    personalNumber: row.personal_number,
    driverLicenseManual: row.driver_license_manual,
    driverLicenseAutomatic: row.driver_license_automatic,
    allergies: row.allergies,
    roleProfiles: parseJsonValue<StoredStaffRoleProfiles>(row.role_profiles_json, {} as StoredStaffRoleProfiles),
    profileComments: row.profile_comments,
    documents: parseJsonValue<BackendDocumentSummary[]>(row.documents_json, []),
    pendingRecords: parseJsonValue<string[]>(row.pending_records_json, []),
  });
}

function getDatabaseStaffProfileLookupResult(
  row: StaffProfileRow | null,
): StaffProfileDatabaseLookupResult {
  if (!row) {
    return { status: "missing" };
  }

  if (row.is_deleted) {
    return { status: "deleted" };
  }

  return {
    status: "found",
    profile: mapStaffProfileRow(row),
  };
}

async function getDatabaseStaffProfileRows() {
  const sql = getPostgresClient();

  if (!sql) {
    return [] as StaffProfileRow[];
  }

  await ensureProductionStorageSchema();
  return sql<StaffProfileRow[]>`
    select *
    from staff_profiles
    order by is_deleted asc, display_name asc
  `;
}

async function getDatabaseStaffProfileByIdLookup(personId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return { status: "missing" } satisfies StaffProfileDatabaseLookupResult;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<StaffProfileRow[]>`
    select *
    from staff_profiles
    where id = ${personId}
    limit 1
  `;

  return getDatabaseStaffProfileLookupResult(rows[0] ?? null);
}

async function getDatabaseStaffProfileByEmailLookup(email: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return { status: "missing" } satisfies StaffProfileDatabaseLookupResult;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<StaffProfileRow[]>`
    select *
    from staff_profiles
    where email_lower = ${email.trim().toLowerCase()}
    limit 1
  `;

  return getDatabaseStaffProfileLookupResult(rows[0] ?? null);
}

async function upsertDatabaseStaffProfile(
  profile: StoredStaffProfile,
  options?: { isDeleted?: boolean },
) {
  const sql = getPostgresClient();

  if (!sql) {
    return profile;
  }

  await ensureProductionStorageSchema();
  const now = new Date().toISOString();
  await sql`
    insert into staff_profiles (
      id, display_name, email, email_lower, phone, country, region, regions_json, roles_json,
      priority, availability, approval_status, access_role_label, registration_status,
      registration_label, profile_approved, profile_approval_label, profile_image_name,
      profile_image_url, bank_name, bank_details, personal_number, driver_license_manual,
      driver_license_automatic, allergies, role_profiles_json, profile_comments, documents_json,
      pending_records_json, is_deleted, created_at, updated_at
    ) values (
      ${profile.id},
      ${profile.displayName},
      ${profile.email},
      ${profile.email.toLowerCase()},
      ${profile.phone},
      ${profile.country},
      ${profile.region},
      ${serializeJson(profile.regions)},
      ${serializeJson(profile.roles)},
      ${profile.priority},
      ${profile.availability},
      ${profile.approvalStatus},
      ${profile.accessRoleLabel},
      ${profile.registrationStatus},
      ${profile.registrationLabel},
      ${profile.profileApproved},
      ${profile.profileApprovalLabel},
      ${profile.profileImageName},
      ${profile.profileImageUrl ?? null},
      ${profile.bankName},
      ${profile.bankDetails},
      ${profile.personalNumber},
      ${profile.driverLicenseManual},
      ${profile.driverLicenseAutomatic},
      ${profile.allergies},
      ${serializeJson(profile.roleProfiles)},
      ${profile.profileComments},
      ${serializeJson(profile.documents)},
      ${serializeJson(profile.pendingRecords)},
      ${options?.isDeleted ?? false},
      ${now},
      ${now}
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      email = excluded.email,
      email_lower = excluded.email_lower,
      phone = excluded.phone,
      country = excluded.country,
      region = excluded.region,
      regions_json = excluded.regions_json,
      roles_json = excluded.roles_json,
      priority = excluded.priority,
      availability = excluded.availability,
      approval_status = excluded.approval_status,
      access_role_label = excluded.access_role_label,
      registration_status = excluded.registration_status,
      registration_label = excluded.registration_label,
      profile_approved = excluded.profile_approved,
      profile_approval_label = excluded.profile_approval_label,
      profile_image_name = excluded.profile_image_name,
      profile_image_url = excluded.profile_image_url,
      bank_name = excluded.bank_name,
      bank_details = excluded.bank_details,
      personal_number = excluded.personal_number,
      driver_license_manual = excluded.driver_license_manual,
      driver_license_automatic = excluded.driver_license_automatic,
      allergies = excluded.allergies,
      role_profiles_json = excluded.role_profiles_json,
      profile_comments = excluded.profile_comments,
      documents_json = excluded.documents_json,
      pending_records_json = excluded.pending_records_json,
      is_deleted = excluded.is_deleted,
      updated_at = excluded.updated_at
  `;

  return profile;
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
  await ensureJsonFile(storePath, createSeedStaffProfiles());
}

async function ensureArchivedDocumentsStore() {
  if (getPostgresClient()) {
    return;
  }

  await ensureJsonFile(archivedDocumentsStorePath, [] as ArchivedStaffDocumentRecord[]);
}

async function readStaffStore() {
  await ensureStaffStore();
  const parsed = await readJsonFile<StoredStaffProfile[]>(
    storePath,
    createSeedStaffProfiles(),
  );
  return parsed.map(normalizeStoredStaffProfile);
}

async function writeStaffStore(profiles: StoredStaffProfile[]) {
  await writeJsonFile(storePath, profiles);
}

async function readArchivedDocumentsStore() {
  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<ArchivedStaffDocumentRow[]>`
      select *
      from archived_staff_documents
      order by archived_at desc, archived_id desc
    `;

    return rows
      .map((row) =>
        parseJsonValue<ArchivedStaffDocumentRecord | null>(row.record_json, null),
      )
      .filter((record): record is ArchivedStaffDocumentRecord => Boolean(record));
  }

  await ensureArchivedDocumentsStore();
  return readJsonFile<ArchivedStaffDocumentRecord[]>(archivedDocumentsStorePath, []);
}

async function writeArchivedDocumentsStore(records: ArchivedStaffDocumentRecord[]) {
  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    await sql`delete from archived_staff_documents`;

    for (const record of records) {
      await sql`
        insert into archived_staff_documents (
          archived_id,
          source_profile_id,
          archived_at,
          record_json
        ) values (
          ${record.archivedId},
          ${record.sourceProfileId},
          ${record.archivedAt},
          ${serializeJson(record)}
        )
      `;
    }

    return;
  }

  await writeJsonFile(archivedDocumentsStorePath, records);
}

async function getFallbackStoredStaffProfiles() {
  return isDatabaseConfigured() ? createSeedStaffProfiles() : readStaffStore();
}

export async function getAllStoredStaffProfiles() {
  try {
    const seedProfilesSource = isDatabaseConfigured()
      ? createSeedStaffProfiles()
      : await readStaffStore();
    const [seedProfiles, databaseRows] = await Promise.all([
      Promise.resolve(seedProfilesSource),
      getDatabaseStaffProfileRows(),
    ]);

    if (databaseRows.length === 0) {
      return seedProfiles;
    }

    const blockedIds = new Set(databaseRows.map((row) => row.id));
    const blockedEmails = new Set(
      databaseRows.map((row) => row.email.trim().toLowerCase()),
    );
    const databaseProfiles = databaseRows
      .filter((row) => !row.is_deleted)
      .map(mapStaffProfileRow);

    return [
      ...databaseProfiles,
      ...seedProfiles.filter((profile) => {
        const normalizedEmail = profile.email.toLowerCase();
        return !blockedIds.has(profile.id) && !blockedEmails.has(normalizedEmail);
      }),
    ];
  } catch (error) {
    logStaffStoreFallback("getAllStoredStaffProfiles", error);
    return getFallbackStoredStaffProfiles();
  }
}

export async function getArchivedStaffDocuments() {
  return readArchivedDocumentsStore();
}

export async function getStoredStaffProfileById(personId: string) {
  try {
    const databaseLookup = await getDatabaseStaffProfileByIdLookup(personId);

    if (databaseLookup.status === "found") {
      return databaseLookup.profile;
    }

    if (databaseLookup.status === "deleted") {
      return null;
    }

    const profiles = await getFallbackStoredStaffProfiles();
    return profiles.find((profile) => profile.id === personId);
  } catch (error) {
    logStaffStoreFallback(`getStoredStaffProfileById(${personId})`, error);
    const profiles = await getFallbackStoredStaffProfiles();
    return profiles.find((profile) => profile.id === personId) ?? null;
  }
}

export async function getStoredStaffProfileByEmail(email: string) {
  try {
    const databaseLookup = await getDatabaseStaffProfileByEmailLookup(email);

    if (databaseLookup.status === "found") {
      return databaseLookup.profile;
    }

    if (databaseLookup.status === "deleted") {
      return null;
    }

    const profiles = await getFallbackStoredStaffProfiles();
    return (
      profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase()) ?? null
    );
  } catch (error) {
    logStaffStoreFallback(`getStoredStaffProfileByEmail(${email})`, error);
    const profiles = await getFallbackStoredStaffProfiles();
    return (
      profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase()) ?? null
    );
  }
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

function buildUpdatedStoredStaffProfile(
  existingProfile: StoredStaffProfile,
  updates: StaffProfileUpdate,
) {
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

  return normalizeStoredStaffProfile({
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
  });
}

function buildDeletedStoredStaffProfile(profile: StoredStaffProfile) {
  return normalizeStoredStaffProfile({
    ...profile,
    documents: [],
    pendingRecords: [],
    approvalStatus: "Archived",
    registrationStatus: "DEACTIVATED",
    registrationLabel: getRegistrationLabel("DEACTIVATED"),
    profileApproved: false,
    profileApprovalLabel: getProfileApprovalLabel(false),
  });
}

export async function updateStoredStaffProfile(
  personId: string,
  updates: StaffProfileUpdate,
) {
  const databaseLookup = await getDatabaseStaffProfileByIdLookup(personId);

  if (databaseLookup.status === "deleted") {
    return null;
  }

  const seedProfile = isDatabaseConfigured()
    ? createSeedStaffProfiles().find((profile) => profile.id === personId) ?? null
    : null;
  const databaseBackedProfile =
    databaseLookup.status === "found" ? databaseLookup.profile : seedProfile;

  if (databaseBackedProfile) {
    const updatedProfile = buildUpdatedStoredStaffProfile(databaseBackedProfile, updates);
    await upsertDatabaseStaffProfile(updatedProfile);
    return updatedProfile;
  }

  const profiles = await readStaffStore();
  const profileIndex = profiles.findIndex((profile) => profile.id === personId);

  if (profileIndex === -1) {
    return null;
  }

  const existingProfile = profiles[profileIndex];
  const updatedProfile = buildUpdatedStoredStaffProfile(existingProfile, updates);

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
  const sql = getPostgresClient();
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

  if (sql) {
    await upsertDatabaseStaffProfile(normalizedProfile);
    return normalizedProfile;
  }

  const profiles = await readStaffStore();
  profiles.unshift(normalizedProfile);
  await writeStaffStore(profiles);

  return normalizedProfile;
}

export async function deleteStoredStaffProfile(personId: string) {
  const databaseLookup = await getDatabaseStaffProfileByIdLookup(personId);

  if (databaseLookup.status === "deleted") {
    return null;
  }

  const sql = getPostgresClient();
  const seedProfile =
    databaseLookup.status === "missing" && isDatabaseConfigured()
      ? createSeedStaffProfiles().find((profile) => profile.id === personId) ?? null
      : null;
  const fileProfiles =
    databaseLookup.status === "missing" && !isDatabaseConfigured()
      ? await readStaffStore()
      : null;
  const profile =
    databaseLookup.status === "found"
      ? databaseLookup.profile
      : seedProfile ?? fileProfiles?.find((staffProfile) => staffProfile.id === personId) ?? null;

  if (!profile) {
    return null;
  }

  const archivedAt = new Date().toISOString();
  const [
    archivedDocuments,
    generatedDocuments,
    { removeStoredStaffDocumentsForPerson },
    { deleteStaffAppAccountsByLinkedStaffProfileId },
    { deleteStaffOnboardingRecordsByStaffProfileId },
  ] = await Promise.all([
    readArchivedDocumentsStore(),
    import("@/lib/staff-document-store").then(({ getStoredStaffDocuments }) =>
      getStoredStaffDocuments(personId),
    ),
    import("@/lib/staff-document-store"),
    import("@/lib/staff-app-store"),
    import("@/lib/staff-onboarding-store"),
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
  const nextArchivedDocuments = [
    ...archivedProfileDocuments,
    ...archivedGeneratedDocuments,
    ...archivedDocuments,
  ];

  if (sql) {
    await Promise.all([
      upsertDatabaseStaffProfile(buildDeletedStoredStaffProfile(profile), {
        isDeleted: true,
      }),
      writeArchivedDocumentsStore(nextArchivedDocuments),
      removeStoredStaffDocumentsForPerson(personId).catch(() => 0),
      deleteStaffAppAccountsByLinkedStaffProfileId(personId),
      deleteStaffOnboardingRecordsByStaffProfileId(personId),
    ]);
  } else {
    const profiles = fileProfiles ?? (await readStaffStore());
    const profileIndex = profiles.findIndex((staffProfile) => staffProfile.id === personId);

    if (profileIndex === -1) {
      return null;
    }

    profiles.splice(profileIndex, 1);

    await Promise.all([
      writeStaffStore(profiles),
      writeArchivedDocumentsStore(nextArchivedDocuments),
      removeStoredStaffDocumentsForPerson(personId).catch(() => 0),
      deleteStaffAppAccountsByLinkedStaffProfileId(personId),
      deleteStaffOnboardingRecordsByStaffProfileId(personId),
    ]);
  }

  return {
    deletedProfile: profile,
    archivedDocumentCount:
      archivedProfileDocuments.length + archivedGeneratedDocuments.length,
  };
}
