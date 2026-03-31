import fs from "node:fs/promises";
import path from "node:path";

import {
  createPasswordHash,
  getSeedScmStaffPassword,
  verifyPasswordHash,
} from "@/lib/password-utils";
import {
  deriveStaffAppRoleScopesFromRoleProfiles,
} from "@/lib/staff-app-scope";
import type { StaffAppAccount, StaffAppRoleScope, StaffAppScopeRole } from "@/types/staff-app";
import type { StoredStaffRoleProfiles } from "@/types/staff-role";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-app-account-store.json");

function createSeedStaffAppAccounts(): StaffAppAccount[] {
  return [
    {
      id: "staff-app-user-1",
      linkedStaffProfileId: "staff-2",
      displayName: "Anton Scholdberg",
      email: "anton@scm.se",
      phone: "+46 70 222 2222",
      country: "Sweden",
      region: "Stockholm",
      roleScopes: [
        { role: "Seller", level: 1 },
        { role: "Stand Leader", level: 1 },
      ],
      profileImageUrl: "/staff-images/staff-2/20251003-171602932-ios-849647f3.jpg",
      passwordHash: createPasswordHash("anton123"),
    },
  ];
}

type LegacyStaffAppAccount = StaffAppAccount & {
  approvedRoles?: StaffAppScopeRole[];
  staffLevel?: number;
};

function normalizeRoleScopes(
  roleScopes: StaffAppRoleScope[] | undefined,
  approvedRoles: StaffAppScopeRole[] | undefined,
  staffLevel: number | undefined,
) {
  if (roleScopes && roleScopes.length > 0) {
    return roleScopes;
  }

  if (approvedRoles && approvedRoles.length > 0) {
    return approvedRoles.map((role) => ({
      role,
      level: Math.min(5, Math.max(1, Math.round(staffLevel ?? 3))) as 1 | 2 | 3 | 4 | 5,
    }));
  }

  return [] as StaffAppRoleScope[];
}

function createStaffAppAccountFromLinkedStaffProfile(profile: {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  roleProfiles?: Partial<StoredStaffRoleProfiles>;
  roles: string[];
  priority: number;
  profileImageUrl?: string;
}): StaffAppAccount {
  return {
    id: `staff-app-${profile.id}`,
    linkedStaffProfileId: profile.id,
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone,
    country: profile.country,
    region: profile.region,
    roleScopes: deriveStaffAppRoleScopesFromRoleProfiles(
      profile.roleProfiles,
      profile.roles,
      profile.priority,
    ),
    profileImageUrl: profile.profileImageUrl,
    passwordHash: createPasswordHash(getSeedScmStaffPassword(profile.email)),
  };
}

function normalizeStaffAppAccount(account: LegacyStaffAppAccount): StaffAppAccount {
  return {
    id: account.id,
    linkedStaffProfileId: account.linkedStaffProfileId,
    displayName: account.displayName,
    email: account.email,
    phone: account.phone,
    country: account.country,
    region: account.region,
    roleScopes: normalizeRoleScopes(account.roleScopes, account.approvedRoles, account.staffLevel),
    profileImageUrl: account.profileImageUrl,
    passwordHash: account.passwordHash,
  };
}

async function ensureStaffAppAccountStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify(createSeedStaffAppAccounts(), null, 2),
      "utf8",
    );
  }
}

async function readStaffAppAccountStore() {
  await ensureStaffAppAccountStore();
  const raw = await fs.readFile(storePath, "utf8");
  return (JSON.parse(raw) as LegacyStaffAppAccount[]).map(normalizeStaffAppAccount);
}

async function writeStaffAppAccountStore(accounts: StaffAppAccount[]) {
  await fs.writeFile(storePath, JSON.stringify(accounts, null, 2), "utf8");
}

export async function getAllStaffAppAccounts() {
  return readStaffAppAccountStore();
}

export async function getStaffAppAccountById(accountId: string) {
  const accounts = await readStaffAppAccountStore();
  return accounts.find((account) => account.id === accountId) ?? null;
}

export async function getStaffAppAccountByEmail(email: string) {
  const accounts = await readStaffAppAccountStore();
  return (
    accounts.find((account) => account.email.toLowerCase() === email.toLowerCase()) ?? null
  );
}

export async function getStaffAppAccountByLinkedStaffProfileId(staffProfileId: string) {
  const accounts = await readStaffAppAccountStore();
  return (
    accounts.find((account) => account.linkedStaffProfileId === staffProfileId) ?? null
  );
}

export function verifyStaffAppAccountPassword(account: StaffAppAccount, password: string) {
  return verifyPasswordHash(password, account.passwordHash);
}

export async function updateStaffAppAccountPassword(accountId: string, password: string) {
  const accounts = await readStaffAppAccountStore();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);

  if (accountIndex === -1) {
    return null;
  }

  accounts[accountIndex] = {
    ...accounts[accountIndex],
    passwordHash: createPasswordHash(password),
  };

  await writeStaffAppAccountStore(accounts);
  return accounts[accountIndex];
}

export async function updateStaffAppAccountPasswordByLinkedStaffProfileId(
  staffProfileId: string,
  password: string,
) {
  const accounts = await readStaffAppAccountStore();
  const accountIndex = accounts.findIndex(
    (account) => account.linkedStaffProfileId === staffProfileId,
  );

  if (accountIndex === -1) {
    return null;
  }

  accounts[accountIndex] = {
    ...accounts[accountIndex],
    passwordHash: createPasswordHash(password),
  };

  await writeStaffAppAccountStore(accounts);
  return accounts[accountIndex];
}

export async function syncStaffAppAccountFromLinkedStaffProfile(profile: {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  roleProfiles?: Partial<StoredStaffRoleProfiles>;
  roles: string[];
  priority: number;
  profileImageUrl?: string;
}) {
  const ensuredAccount = await ensureStaffAppAccountForLinkedStaffProfile(profile);
  const accounts = await readStaffAppAccountStore();
  const accountIndex = accounts.findIndex(
    (account) => account.id === ensuredAccount.id,
  );

  accounts[accountIndex] = {
    ...accounts[accountIndex],
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone,
    country: profile.country,
    region: profile.region,
    roleScopes: deriveStaffAppRoleScopesFromRoleProfiles(
      profile.roleProfiles,
      profile.roles,
      profile.priority,
    ),
    profileImageUrl: profile.profileImageUrl,
  };

  await writeStaffAppAccountStore(accounts);
  return accounts[accountIndex];
}

export async function ensureStaffAppAccountForLinkedStaffProfile(profile: {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  roleProfiles?: Partial<StoredStaffRoleProfiles>;
  roles: string[];
  priority: number;
  profileImageUrl?: string;
}) {
  const accounts = await readStaffAppAccountStore();
  const linkedIndex = accounts.findIndex(
    (account) => account.linkedStaffProfileId === profile.id,
  );
  const emailIndex = accounts.findIndex(
    (account) => account.email.toLowerCase() === profile.email.toLowerCase(),
  );

  if (linkedIndex !== -1) {
    const linkedAccount = accounts[linkedIndex];
    const nextAccount: StaffAppAccount = {
      ...linkedAccount,
      linkedStaffProfileId: profile.id,
      displayName: profile.displayName,
      email: profile.email,
      phone: profile.phone,
      country: profile.country,
      region: profile.region,
      roleScopes: deriveStaffAppRoleScopesFromRoleProfiles(
        profile.roleProfiles,
        profile.roles,
        profile.priority,
      ),
      profileImageUrl: profile.profileImageUrl,
    };

    accounts[linkedIndex] = nextAccount;
    await writeStaffAppAccountStore(accounts);
    return nextAccount;
  }

  if (emailIndex !== -1) {
    const emailMatchedAccount = accounts[emailIndex];
    const nextAccount: StaffAppAccount = {
      ...emailMatchedAccount,
      linkedStaffProfileId: profile.id,
      displayName: profile.displayName,
      email: profile.email,
      phone: profile.phone,
      country: profile.country,
      region: profile.region,
      roleScopes: deriveStaffAppRoleScopesFromRoleProfiles(
        profile.roleProfiles,
        profile.roles,
        profile.priority,
      ),
      profileImageUrl: profile.profileImageUrl,
    };

    accounts[emailIndex] = nextAccount;
    await writeStaffAppAccountStore(accounts);
    return nextAccount;
  }

  const createdAccount = createStaffAppAccountFromLinkedStaffProfile(profile);
  accounts.push(createdAccount);
  await writeStaffAppAccountStore(accounts);
  return createdAccount;
}
