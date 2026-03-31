import fs from "node:fs/promises";
import path from "node:path";

import { gigs } from "@/data/scm-data";
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
  const normalizedRegions = normalizeRegions(profile.regions);
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
    assignedGigIds: Array.from(new Set(profile.assignedGigIds)),
    profileImageName: profile.profileImageName?.trim() ?? "",
    profileImageUrl: profile.profileImageUrl?.trim() ?? "",
    notes: profile.notes.trim(),
  };
}

async function ensureScmStaffStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify(createSeedScmStaffProfiles(), null, 2),
      "utf8",
    );
  }
}

async function readScmStaffStore() {
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
}

async function writeScmStaffStore(profiles: StoredScmStaffProfile[]) {
  await fs.writeFile(storePath, JSON.stringify(profiles, null, 2), "utf8");
}

export async function getAllStoredScmStaffProfiles() {
  return readScmStaffStore();
}

export async function getStoredScmStaffProfileById(personId: string) {
  const profiles = await readScmStaffStore();
  return profiles.find((profile) => profile.id === personId);
}

export async function getStoredScmStaffProfileByEmail(email: string) {
  const profiles = await readScmStaffStore();
  return profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase());
}

export async function getCurrentStoredScmStaffProfile(baseSummary: {
  id: string;
  email: string;
}) {
  const profiles = await readScmStaffStore();

  return (
    profiles.find((profile) => profile.id === baseSummary.id) ??
    profiles.find(
      (profile) => profile.email.toLowerCase() === baseSummary.email.toLowerCase(),
    )
  );
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

  const profiles = await readScmStaffStore();
  const createdProfile = normalizeStoredScmStaffProfile({
    ...input,
    id: createScmStaffId(input.roleKey),
  });

  if (!createdProfile) {
    throw new Error("Temporary Gig Manager profiles must be created from Share gig info.");
  }

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

  const profiles = await readScmStaffStore();
  const profileIndex = profiles.findIndex((profile) => profile.id === personId);

  if (profileIndex === -1) {
    return null;
  }

  const currentProfile = profiles[profileIndex];
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

  profiles[profileIndex] = updatedProfile;
  await writeScmStaffStore(profiles);

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
