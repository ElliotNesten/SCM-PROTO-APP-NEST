import fs from "node:fs/promises";
import path from "node:path";

import { gigs } from "@/data/scm-data";
import {
  ensureProductionStorageSchema,
  getPostgresClient,
  parseJsonValue,
  serializeJson,
} from "@/lib/postgres";
import {
  getSeedScmStaffPassword,
  createPasswordHash,
  verifyPasswordHash,
} from "@/lib/password-utils";
import {
  getRegionalManagerRegionSummary,
  getScmRoleDefinition,
  isManuallyManagedScmStaffRole,
  type StoredScmStaffProfile,
} from "@/types/scm-rbac";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "scm-staff-store.json");

type ScmStaffProfileRow = {
  id: string;
  display_name: string;
  email: string;
  email_lower: string;
  password_hash: string;
  password_plaintext: string | null;
  phone: string;
  role_key: StoredScmStaffProfile["roleKey"];
  country: string;
  regions_json: string;
  assigned_gig_ids_json: string;
  linked_staff_id: string | null;
  linked_staff_name: string | null;
  profile_image_name: string;
  profile_image_url: string | null;
  notes: string;
  is_deleted: boolean;
};

type ScmStaffDatabaseLookupResult =
  | { status: "missing" }
  | { status: "deleted" }
  | { status: "found"; profile: StoredScmStaffProfile };

function shouldIgnoreReadOnlyStoreWriteError(error: unknown) {
  const errorCode =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";

  return (
    errorCode === "EACCES" ||
    errorCode === "EPERM" ||
    errorCode === "EROFS" ||
    errorCode === "ENOENT"
  );
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

function createScmStaffId(roleKey: StoredScmStaffProfile["roleKey"]) {
  const rolePrefixByKey: Record<StoredScmStaffProfile["roleKey"], string> = {
    superAdmin: "scm-super",
    officeStaff: "scm-office",
    regionalManager: "scm-region",
    temporaryGigManager: "scm-gig",
  };

  return `${rolePrefixByKey[roleKey]}-${Date.now().toString(36)}`;
}

function getDisplayInitials(displayName: string) {
  return displayName
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function createSeedScmStaffProfiles(): StoredScmStaffProfile[] {
  return [
    {
      id: "office-1",
      displayName: "Edwin Jones",
      email: "edwin.jones@scm.se",
      passwordHash: createPasswordHash(getSeedScmStaffPassword("edwin.jones@scm.se")),
      passwordPlaintext: getSeedScmStaffPassword("edwin.jones@scm.se"),
      phone: "+46 70 123 45 67",
      roleKey: "superAdmin",
      country: "Global",
      regions: [],
      assignedGigIds: gigs.map((gig) => gig.id),
      profileImageName: "",
      profileImageUrl: "",
      notes:
        "Primary platform owner with full system-wide access and responsibility for role management.",
    },
    {
      id: "scm-office-2",
      displayName: "Mia Lund",
      email: "mia.lund@scm.se",
      passwordHash: createPasswordHash(getSeedScmStaffPassword("mia.lund@scm.se")),
      passwordPlaintext: getSeedScmStaffPassword("mia.lund@scm.se"),
      phone: "+46 70 333 10 20",
      roleKey: "officeStaff",
      country: "Global",
      regions: [],
      assignedGigIds: [],
      profileImageName: "",
      profileImageUrl: "",
      notes:
        "Coordinates office workflows, shared assets, and broad administrative gig support.",
    },
    {
      id: "scm-region-1",
      displayName: "Henrik Borg",
      email: "henrik.borg@scm.se",
      passwordHash: createPasswordHash(getSeedScmStaffPassword("henrik.borg@scm.se")),
      passwordPlaintext: getSeedScmStaffPassword("henrik.borg@scm.se"),
      phone: "+46 70 555 11 12",
      roleKey: "regionalManager",
      country: "Sweden",
      regions: ["Gothenburg"],
      assignedGigIds: ["gig-2"],
      profileImageName: "",
      profileImageUrl: "",
      notes:
        "Owns the Gothenburg region and can manage staffing, bookings, and payroll visibility there.",
    },
    {
      id: "scm-region-2",
      displayName: "Ingrid Olsen",
      email: "ingrid.olsen@scm.no",
      passwordHash: createPasswordHash(getSeedScmStaffPassword("ingrid.olsen@scm.no")),
      passwordPlaintext: getSeedScmStaffPassword("ingrid.olsen@scm.no"),
      phone: "+47 91 200 300",
      roleKey: "regionalManager",
      country: "Norway",
      regions: ["Oslo"],
      assignedGigIds: ["gig-3"],
      profileImageName: "",
      profileImageUrl: "",
      notes:
        "Regional owner for Oslo operations with payroll access restricted to Norway.",
    },
    {
      id: "scm-region-3",
      displayName: "Nora Beck",
      email: "nora.beck@scm.dk",
      passwordHash: createPasswordHash(getSeedScmStaffPassword("nora.beck@scm.dk")),
      passwordPlaintext: getSeedScmStaffPassword("nora.beck@scm.dk"),
      phone: "+45 21 30 40 50",
      roleKey: "regionalManager",
      country: "Denmark",
      regions: ["Capital"],
      assignedGigIds: ["gig-4"],
      profileImageName: "",
      profileImageUrl: "",
      notes:
        "Regional owner for Denmark with scope focused on Copenhagen and Capital gigs.",
    },
  ];
}

function normalizeStoredScmStaffProfile(
  profile: StoredScmStaffProfile,
): StoredScmStaffProfile | null {
  const roleKey = profile.roleKey;

  if (!isManuallyManagedScmStaffRole(roleKey)) {
    return null;
  }

  const normalizedCountry =
    roleKey === "regionalManager" ? profile.country || "Sweden" : "Global";
  const normalizedRegions = normalizeRegions(profile.regions ?? []);
  const swedenOnlyRegions = normalizedCountry === "Sweden" ? normalizedRegions : [];
  const fallbackSeedPassword = getSeedScmStaffPassword(profile.email);
  const normalizedPasswordHash =
    profile.passwordHash?.trim() || createPasswordHash(fallbackSeedPassword);
  const normalizedPasswordPlaintext =
    profile.passwordPlaintext?.trim() ||
    (verifyPasswordHash(fallbackSeedPassword, normalizedPasswordHash)
      ? fallbackSeedPassword
      : "");

  return {
    ...profile,
    passwordHash: normalizedPasswordHash,
    passwordPlaintext: normalizedPasswordPlaintext,
    country: normalizedCountry,
    regions: roleKey === "regionalManager" ? swedenOnlyRegions : [],
    assignedGigIds: Array.from(new Set(profile.assignedGigIds ?? [])),
    linkedStaffId: profile.linkedStaffId?.trim() || undefined,
    linkedStaffName: profile.linkedStaffName?.trim() || undefined,
    profileImageName: profile.profileImageName?.trim() ?? "",
    profileImageUrl: profile.profileImageUrl?.trim() ?? "",
    notes: profile.notes?.trim() ?? "",
  };
}

function mapScmStaffProfileRow(
  row: ScmStaffProfileRow,
): StoredScmStaffProfile | null {
  return normalizeStoredScmStaffProfile({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    passwordHash: row.password_hash,
    passwordPlaintext: row.password_plaintext ?? undefined,
    phone: row.phone,
    roleKey: row.role_key,
    country: row.country,
    regions: parseJsonValue<string[]>(row.regions_json, []),
    assignedGigIds: parseJsonValue<string[]>(row.assigned_gig_ids_json, []),
    linkedStaffId: row.linked_staff_id ?? undefined,
    linkedStaffName: row.linked_staff_name ?? undefined,
    profileImageName: row.profile_image_name,
    profileImageUrl: row.profile_image_url ?? undefined,
    notes: row.notes,
  });
}

function getDatabaseLookupResult(row: ScmStaffProfileRow | null): ScmStaffDatabaseLookupResult {
  if (!row) {
    return { status: "missing" };
  }

  if (row.is_deleted) {
    return { status: "deleted" };
  }

  const profile = mapScmStaffProfileRow(row);

  if (!profile) {
    return { status: "missing" };
  }

  return {
    status: "found",
    profile,
  };
}

async function getDatabaseScmStaffRows() {
  const sql = getPostgresClient();

  if (!sql) {
    return [] as ScmStaffProfileRow[];
  }

  await ensureProductionStorageSchema();
  return sql<ScmStaffProfileRow[]>`
    select *
    from scm_staff_profiles
    order by is_deleted asc, updated_at desc, display_name asc
  `;
}

async function getDatabaseScmStaffProfileByIdLookup(personId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return { status: "missing" } satisfies ScmStaffDatabaseLookupResult;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<ScmStaffProfileRow[]>`
    select *
    from scm_staff_profiles
    where id = ${personId}
    limit 1
  `;

  return getDatabaseLookupResult(rows[0] ?? null);
}

async function getDatabaseScmStaffProfileByEmailLookup(email: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return { status: "missing" } satisfies ScmStaffDatabaseLookupResult;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<ScmStaffProfileRow[]>`
    select *
    from scm_staff_profiles
    where email_lower = ${email.trim().toLowerCase()}
    order by is_deleted asc, updated_at desc
    limit 1
  `;

  return getDatabaseLookupResult(rows[0] ?? null);
}

async function upsertDatabaseScmStaffProfile(
  profile: StoredScmStaffProfile,
  options?: { isDeleted?: boolean },
) {
  const sql = getPostgresClient();

  if (!sql) {
    return profile;
  }

  await ensureProductionStorageSchema();
  const now = new Date().toISOString();

  await sql`
    insert into scm_staff_profiles (
      id,
      display_name,
      email,
      email_lower,
      password_hash,
      password_plaintext,
      phone,
      role_key,
      country,
      regions_json,
      assigned_gig_ids_json,
      linked_staff_id,
      linked_staff_name,
      profile_image_name,
      profile_image_url,
      notes,
      is_deleted,
      created_at,
      updated_at
    ) values (
      ${profile.id},
      ${profile.displayName},
      ${profile.email},
      ${profile.email.toLowerCase()},
      ${profile.passwordHash},
      ${profile.passwordPlaintext ?? null},
      ${profile.phone},
      ${profile.roleKey},
      ${profile.country},
      ${serializeJson(profile.regions)},
      ${serializeJson(profile.assignedGigIds)},
      ${profile.linkedStaffId ?? null},
      ${profile.linkedStaffName ?? null},
      ${profile.profileImageName ?? ""},
      ${profile.profileImageUrl ?? null},
      ${profile.notes},
      ${options?.isDeleted ?? false},
      ${now},
      ${now}
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      email = excluded.email,
      email_lower = excluded.email_lower,
      password_hash = excluded.password_hash,
      password_plaintext = excluded.password_plaintext,
      phone = excluded.phone,
      role_key = excluded.role_key,
      country = excluded.country,
      regions_json = excluded.regions_json,
      assigned_gig_ids_json = excluded.assigned_gig_ids_json,
      linked_staff_id = excluded.linked_staff_id,
      linked_staff_name = excluded.linked_staff_name,
      profile_image_name = excluded.profile_image_name,
      profile_image_url = excluded.profile_image_url,
      notes = excluded.notes,
      is_deleted = excluded.is_deleted,
      updated_at = excluded.updated_at
  `;

  return profile;
}

async function ensureScmStaffStore() {
  try {
    await fs.access(storePath);
  } catch {
    try {
      await fs.mkdir(storeDirectory, { recursive: true });
      await fs.writeFile(
        storePath,
        JSON.stringify(createSeedScmStaffProfiles(), null, 2),
        "utf8",
      );
    } catch (error) {
      if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
        throw error;
      }
    }
  }
}

async function readScmStaffStore() {
  try {
    await ensureScmStaffStore();
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as StoredScmStaffProfile[];
    const normalizedProfiles = parsed
      .map(normalizeStoredScmStaffProfile)
      .filter((profile): profile is StoredScmStaffProfile => Boolean(profile));

    if (normalizedProfiles.length !== parsed.length) {
      try {
        await writeScmStaffStore(normalizedProfiles);
      } catch (error) {
        if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
          throw error;
        }
      }
    }

    return normalizedProfiles;
  } catch (error) {
    if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
      throw error;
    }

    return createSeedScmStaffProfiles();
  }
}

async function writeScmStaffStore(profiles: StoredScmStaffProfile[]) {
  await fs.mkdir(storeDirectory, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(profiles, null, 2), "utf8");
}

export async function getAllStoredScmStaffProfiles() {
  const [seedProfiles, databaseRows] = await Promise.all([
    readScmStaffStore(),
    getDatabaseScmStaffRows(),
  ]);

  if (databaseRows.length === 0) {
    return seedProfiles;
  }

  const blockedIds = new Set(databaseRows.map((row) => row.id));
  const blockedEmails = new Set(databaseRows.map((row) => row.email_lower));
  const databaseProfiles = databaseRows
    .filter((row) => !row.is_deleted)
    .map(mapScmStaffProfileRow)
    .filter((profile): profile is StoredScmStaffProfile => Boolean(profile));

  return [
    ...databaseProfiles,
    ...seedProfiles.filter((profile) => {
      const normalizedEmail = profile.email.toLowerCase();
      return !blockedIds.has(profile.id) && !blockedEmails.has(normalizedEmail);
    }),
  ];
}

export async function getStoredScmStaffProfileById(personId: string) {
  const databaseLookup = await getDatabaseScmStaffProfileByIdLookup(personId);

  if (databaseLookup.status === "found") {
    return databaseLookup.profile;
  }

  if (databaseLookup.status === "deleted") {
    return null;
  }

  const profiles = await readScmStaffStore();
  return profiles.find((profile) => profile.id === personId) ?? null;
}

export async function getStoredScmStaffProfileByEmail(email: string) {
  const databaseLookup = await getDatabaseScmStaffProfileByEmailLookup(email);

  if (databaseLookup.status === "found") {
    return databaseLookup.profile;
  }

  if (databaseLookup.status === "deleted") {
    return null;
  }

  const profiles = await readScmStaffStore();
  return (
    profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase()) ?? null
  );
}

export async function getCurrentStoredScmStaffProfile(baseSummary: {
  id: string;
  email: string;
}) {
  const matchedById = await getStoredScmStaffProfileById(baseSummary.id);

  if (matchedById) {
    return matchedById;
  }

  return getStoredScmStaffProfileByEmail(baseSummary.email);
}

export async function getCurrentScmStaffUserSummary(baseSummary: {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  roleLabel: string;
  profileImageUrl?: string;
}) {
  const matchedProfile = await getCurrentStoredScmStaffProfile(baseSummary);

  if (!matchedProfile) {
    return baseSummary;
  }

  const displayName = matchedProfile.displayName.trim() || baseSummary.displayName;

  return {
    ...baseSummary,
    displayName,
    initials: getDisplayInitials(displayName),
    roleLabel: getScmRoleDefinition(matchedProfile.roleKey).label,
    profileImageUrl: matchedProfile.profileImageUrl?.trim() ?? "",
  };
}

type ScmStaffProfileUpdate = Partial<StoredScmStaffProfile>;

type CreateScmStaffProfileInput = Omit<StoredScmStaffProfile, "id">;

export async function createStoredScmStaffProfile(input: CreateScmStaffProfileInput) {
  if (!isManuallyManagedScmStaffRole(input.roleKey)) {
    throw new Error("Temporary Gig Manager profiles must be created from Share gig info.");
  }

  const createdProfile = normalizeStoredScmStaffProfile({
    ...input,
    id: createScmStaffId(input.roleKey),
  });

  if (!createdProfile) {
    throw new Error("Temporary Gig Manager profiles must be created from Share gig info.");
  }

  const sql = getPostgresClient();

  if (sql) {
    await upsertDatabaseScmStaffProfile(createdProfile);
    return createdProfile;
  }

  const profiles = await readScmStaffStore();
  profiles.push(createdProfile);
  await writeScmStaffStore(profiles);

  return createdProfile;
}

export async function updateStoredScmStaffProfile(
  personId: string,
  updates: ScmStaffProfileUpdate,
) {
  if (updates.roleKey && !isManuallyManagedScmStaffRole(updates.roleKey)) {
    return null;
  }

  const databaseLookup = await getDatabaseScmStaffProfileByIdLookup(personId);

  if (databaseLookup.status === "deleted") {
    return null;
  }

  const fileProfiles =
    databaseLookup.status === "missing" ? await readScmStaffStore() : null;
  const currentProfile =
    databaseLookup.status === "found"
      ? databaseLookup.profile
      : fileProfiles?.find((profile) => profile.id === personId) ?? null;

  if (!currentProfile) {
    return null;
  }

  const updatedProfile = normalizeStoredScmStaffProfile({
    ...currentProfile,
    ...updates,
    country:
      (updates.roleKey ?? currentProfile.roleKey) === "regionalManager"
        ? updates.country ?? currentProfile.country
        : "Global",
    regions:
      (updates.roleKey ?? currentProfile.roleKey) === "regionalManager"
        ? updates.regions ?? currentProfile.regions
        : [],
  });

  if (!updatedProfile) {
    return null;
  }

  const sql = getPostgresClient();

  if (sql) {
    await upsertDatabaseScmStaffProfile(updatedProfile);
    return updatedProfile;
  }

  if (!fileProfiles) {
    return null;
  }

  const profileIndex = fileProfiles.findIndex((profile) => profile.id === personId);

  if (profileIndex === -1) {
    return null;
  }

  fileProfiles[profileIndex] = updatedProfile;
  await writeScmStaffStore(fileProfiles);

  return updatedProfile;
}

export async function updateStoredScmStaffImage(
  personId: string,
  image: {
    profileImageName: string;
    profileImageUrl: string;
  },
) {
  return updateStoredScmStaffProfile(personId, image);
}

export async function deleteStoredScmStaffProfile(personId: string) {
  const databaseLookup = await getDatabaseScmStaffProfileByIdLookup(personId);

  if (databaseLookup.status === "deleted") {
    return null;
  }

  const sql = getPostgresClient();

  if (databaseLookup.status === "found") {
    if (sql) {
      await upsertDatabaseScmStaffProfile(databaseLookup.profile, { isDeleted: true });
      return databaseLookup.profile;
    }

    const profiles = await readScmStaffStore();
    const profileIndex = profiles.findIndex((profile) => profile.id === personId);

    if (profileIndex === -1) {
      return null;
    }

    const deletedProfile = profiles[profileIndex];
    profiles.splice(profileIndex, 1);
    await writeScmStaffStore(profiles);

    return deletedProfile;
  }

  const profiles = await readScmStaffStore();
  const profileIndex = profiles.findIndex((profile) => profile.id === personId);

  if (profileIndex === -1) {
    return null;
  }

  const deletedProfile = profiles[profileIndex];

  if (sql) {
    await upsertDatabaseScmStaffProfile(deletedProfile, { isDeleted: true });
    return deletedProfile;
  }

  profiles.splice(profileIndex, 1);
  await writeScmStaffStore(profiles);

  return deletedProfile;
}

export function getScmStaffRoleStats(profiles: StoredScmStaffProfile[]) {
  return {
    total: profiles.length,
    superAdmin: profiles.filter((profile) => profile.roleKey === "superAdmin").length,
    officeStaff: profiles.filter((profile) => profile.roleKey === "officeStaff").length,
    regionalManager: profiles.filter((profile) => profile.roleKey === "regionalManager").length,
    temporaryGigManager: profiles.filter(
      (profile) => profile.roleKey === "temporaryGigManager",
    ).length,
  };
}

export function getScmStaffScopeSummary(
  profile: Pick<
    StoredScmStaffProfile,
    "roleKey" | "country" | "regions" | "assignedGigIds"
  >,
) {
  const roleDefinition = getScmRoleDefinition(profile.roleKey);

  if (profile.roleKey === "superAdmin" || profile.roleKey === "officeStaff") {
    return roleDefinition.scopeLabel;
  }

  if (profile.roleKey === "regionalManager") {
    const scopeLabel =
      profile.country === "Sweden"
        ? getRegionalManagerRegionSummary(profile.country, profile.regions)
        : "";

    return [profile.country, scopeLabel].filter(Boolean).join(" | ");
  }

  const assignedGigNames = gigs
    .filter((gig) => profile.assignedGigIds.includes(gig.id))
    .map((gig) => gig.artist);

  return assignedGigNames.length > 0
    ? assignedGigNames.join(", ")
    : "No gigs assigned yet";
}
