import path from "node:path";

import { ensureJsonFile, readJsonFile, writeJsonFile } from "@/lib/json-file-store";
import {
  createPasswordHash,
  getSeedScmStaffPassword,
  verifyPasswordHash,
} from "@/lib/password-utils";
import {
  deriveStaffAppRoleScopesFromRoleProfiles,
} from "@/lib/staff-app-scope";
import {
  ensureProductionStorageSchema,
  getPostgresClient,
  parseJsonValue,
  serializeJson,
} from "@/lib/postgres";
import type { StaffAppAccount, StaffAppRoleScope, StaffAppScopeRole } from "@/types/staff-app";
import type { StoredStaffRoleProfiles } from "@/types/staff-role";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "staff-app-account-store.json");

type StaffAppAccountRow = {
  id: string;
  linked_staff_profile_id: string | null;
  created_from_application_id: string | null;
  display_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  role_scopes_json: string;
  profile_image_url: string | null;
  password_hash: string;
  is_active: boolean;
  must_complete_onboarding: boolean;
  password_set_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
};

function logStaffAppStoreFallback(action: string, error: unknown) {
  console.error(
    `[staff-app-store] ${action} failed. Falling back to bundled staff app data.`,
    error,
  );
}

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

async function tryWriteStaffAppAccountStore(accounts: StaffAppAccount[]) {
  try {
    await writeStaffAppAccountStore(accounts);
  } catch (error) {
    if (!shouldIgnoreReadOnlyStoreWriteError(error)) {
      throw error;
    }
  }
}

function createSeedStaffAppAccounts(): StaffAppAccount[] {
  return [];
}

type LegacyStaffAppAccount = StaffAppAccount & {
  approvedRoles?: StaffAppScopeRole[];
  staffLevel?: number;
  createdFromApplicationId?: string | null;
  isActive?: boolean;
  mustCompleteOnboarding?: boolean;
  passwordSetAt?: string | null;
  activatedAt?: string | null;
  lastLoginAt?: string | null;
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

function createStaffAppAccountFromLinkedStaffProfile(
  profile: {
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
},
  options?: {
    createdFromApplicationId?: string | null;
    passwordHash?: string;
    isActive?: boolean;
    mustCompleteOnboarding?: boolean;
    passwordSetAt?: string | null;
    activatedAt?: string | null;
  },
): StaffAppAccount {
  return {
    id: `staff-app-${profile.id}`,
    linkedStaffProfileId: profile.id,
    createdFromApplicationId: options?.createdFromApplicationId ?? null,
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
    passwordHash:
      options?.passwordHash ?? createPasswordHash(getSeedScmStaffPassword(profile.email)),
    isActive: options?.isActive ?? true,
    mustCompleteOnboarding: options?.mustCompleteOnboarding ?? false,
    passwordSetAt: options?.passwordSetAt ?? null,
    activatedAt: options?.activatedAt ?? null,
    lastLoginAt: null,
  };
}

function normalizeStaffAppAccount(account: LegacyStaffAppAccount): StaffAppAccount {
  return {
    id: account.id,
    linkedStaffProfileId: account.linkedStaffProfileId,
    createdFromApplicationId: account.createdFromApplicationId ?? null,
    displayName: account.displayName,
    email: account.email,
    phone: account.phone,
    country: account.country,
    region: account.region,
    roleScopes: normalizeRoleScopes(account.roleScopes, account.approvedRoles, account.staffLevel),
    profileImageUrl: account.profileImageUrl,
    passwordHash: account.passwordHash,
    isActive: account.isActive ?? true,
    mustCompleteOnboarding: account.mustCompleteOnboarding ?? false,
    passwordSetAt: account.passwordSetAt ?? null,
    activatedAt: account.activatedAt ?? null,
    lastLoginAt: account.lastLoginAt ?? null,
  };
}

function mapStaffAppAccountRow(row: StaffAppAccountRow): StaffAppAccount {
  return {
    id: row.id,
    linkedStaffProfileId: row.linked_staff_profile_id ?? undefined,
    createdFromApplicationId: row.created_from_application_id ?? null,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    region: row.region,
    roleScopes: parseJsonValue<StaffAppRoleScope[]>(row.role_scopes_json, []),
    profileImageUrl: row.profile_image_url ?? undefined,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    mustCompleteOnboarding: row.must_complete_onboarding,
    passwordSetAt: row.password_set_at,
    activatedAt: row.activated_at,
    lastLoginAt: row.last_login_at,
  };
}

async function getDatabaseStaffAppAccounts() {
  const sql = getPostgresClient();

  if (!sql) {
    return [] as StaffAppAccount[];
  }

  await ensureProductionStorageSchema();
  const rows = await sql<StaffAppAccountRow[]>`
    select *
    from staff_app_accounts
    order by display_name asc
  `;

  return rows.map(mapStaffAppAccountRow);
}

async function getDatabaseStaffAppAccountById(accountId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return null;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<StaffAppAccountRow[]>`
    select *
    from staff_app_accounts
    where id = ${accountId}
    limit 1
  `;

  return rows[0] ? mapStaffAppAccountRow(rows[0]) : null;
}

async function getDatabaseStaffAppAccountByEmail(email: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return null;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<StaffAppAccountRow[]>`
    select *
    from staff_app_accounts
    where email_lower = ${email.trim().toLowerCase()}
    limit 1
  `;

  return rows[0] ? mapStaffAppAccountRow(rows[0]) : null;
}

async function getDatabaseStaffAppAccountByLinkedStaffProfileId(staffProfileId: string) {
  const sql = getPostgresClient();

  if (!sql) {
    return null;
  }

  await ensureProductionStorageSchema();
  const rows = await sql<StaffAppAccountRow[]>`
    select *
    from staff_app_accounts
    where linked_staff_profile_id = ${staffProfileId}
    limit 1
  `;

  return rows[0] ? mapStaffAppAccountRow(rows[0]) : null;
}

async function upsertDatabaseStaffAppAccount(account: StaffAppAccount) {
  const sql = getPostgresClient();

  if (!sql) {
    return account;
  }

  await ensureProductionStorageSchema();
  await sql`
    insert into staff_app_accounts (
      id, linked_staff_profile_id, created_from_application_id, display_name, email,
      email_lower, phone, country, region, role_scopes_json, profile_image_url,
      password_hash, is_active, must_complete_onboarding, password_set_at, activated_at,
      last_login_at, created_at, updated_at
    ) values (
      ${account.id},
      ${account.linkedStaffProfileId ?? null},
      ${account.createdFromApplicationId ?? null},
      ${account.displayName},
      ${account.email},
      ${account.email.toLowerCase()},
      ${account.phone},
      ${account.country},
      ${account.region},
      ${serializeJson(account.roleScopes)},
      ${account.profileImageUrl ?? null},
      ${account.passwordHash},
      ${account.isActive},
      ${account.mustCompleteOnboarding},
      ${account.passwordSetAt ?? null},
      ${account.activatedAt ?? null},
      ${account.lastLoginAt ?? null},
      ${new Date().toISOString()},
      ${new Date().toISOString()}
    )
    on conflict (id) do update set
      linked_staff_profile_id = excluded.linked_staff_profile_id,
      created_from_application_id = excluded.created_from_application_id,
      display_name = excluded.display_name,
      email = excluded.email,
      email_lower = excluded.email_lower,
      phone = excluded.phone,
      country = excluded.country,
      region = excluded.region,
      role_scopes_json = excluded.role_scopes_json,
      profile_image_url = excluded.profile_image_url,
      password_hash = excluded.password_hash,
      is_active = excluded.is_active,
      must_complete_onboarding = excluded.must_complete_onboarding,
      password_set_at = excluded.password_set_at,
      activated_at = excluded.activated_at,
      last_login_at = excluded.last_login_at,
      updated_at = excluded.updated_at
  `;

  return account;
}

async function ensureStaffAppAccountStore() {
  await ensureJsonFile(storePath, createSeedStaffAppAccounts());
}

async function readStaffAppAccountStore() {
  await ensureStaffAppAccountStore();
  const parsed = await readJsonFile<LegacyStaffAppAccount[]>(
    storePath,
    createSeedStaffAppAccounts(),
  );
  return parsed.map(normalizeStaffAppAccount);
}

async function writeStaffAppAccountStore(accounts: StaffAppAccount[]) {
  await writeJsonFile(storePath, accounts);
}

async function getFallbackStaffAppAccounts() {
  return readStaffAppAccountStore();
}

export async function getAllStaffAppAccounts() {
  const sql = getPostgresClient();

  if (sql) {
    try {
      return await getDatabaseStaffAppAccounts();
    } catch (error) {
      logStaffAppStoreFallback("getAllStaffAppAccounts", error);
    }
  }

  return getFallbackStaffAppAccounts();
}

export async function getStaffAppAccountById(accountId: string) {
  const sql = getPostgresClient();

  if (sql) {
    try {
      return await getDatabaseStaffAppAccountById(accountId);
    } catch (error) {
      logStaffAppStoreFallback(`getStaffAppAccountById(${accountId})`, error);
    }
  }

  const accounts = await getFallbackStaffAppAccounts();
  return accounts.find((account) => account.id === accountId) ?? null;
}

export async function getStaffAppAccountByEmail(email: string) {
  const sql = getPostgresClient();

  if (sql) {
    try {
      return await getDatabaseStaffAppAccountByEmail(email);
    } catch (error) {
      logStaffAppStoreFallback(`getStaffAppAccountByEmail(${email})`, error);
    }
  }

  const accounts = await getFallbackStaffAppAccounts();
  return (
    accounts.find((account) => account.email.toLowerCase() === email.toLowerCase()) ?? null
  );
}

export async function getStaffAppAccountByLinkedStaffProfileId(staffProfileId: string) {
  const sql = getPostgresClient();

  if (sql) {
    try {
      return await getDatabaseStaffAppAccountByLinkedStaffProfileId(staffProfileId);
    } catch (error) {
      logStaffAppStoreFallback(
        `getStaffAppAccountByLinkedStaffProfileId(${staffProfileId})`,
        error,
      );
    }
  }

  const accounts = await getFallbackStaffAppAccounts();
  return (
    accounts.find((account) => account.linkedStaffProfileId === staffProfileId) ?? null
  );
}

export function verifyStaffAppAccountPassword(account: StaffAppAccount, password: string) {
  if (!account.isActive || !account.passwordHash.trim()) {
    return false;
  }

  return verifyPasswordHash(password, account.passwordHash);
}

export function canStaffAppAccountSignIn(account: StaffAppAccount) {
  return account.isActive && account.passwordHash.trim().length > 0;
}

export async function updateStaffAppAccountPassword(accountId: string, password: string) {
  const sql = getPostgresClient();

  if (sql) {
    const currentAccount = await getStaffAppAccountById(accountId);

    if (!currentAccount) {
      return null;
    }

    const updatedAccount = {
      ...currentAccount,
      passwordHash: createPasswordHash(password),
      passwordSetAt: new Date().toISOString(),
    };

    await upsertDatabaseStaffAppAccount(updatedAccount);
    return updatedAccount;
  }

  const accounts = await readStaffAppAccountStore();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);

  if (accountIndex === -1) {
    return null;
  }

  accounts[accountIndex] = {
    ...accounts[accountIndex],
    passwordHash: createPasswordHash(password),
    passwordSetAt: new Date().toISOString(),
  };

  await writeStaffAppAccountStore(accounts);
  return accounts[accountIndex];
}

export async function updateStaffAppAccountPasswordByLinkedStaffProfileId(
  staffProfileId: string,
  password: string,
) {
  const sql = getPostgresClient();

  if (sql) {
    const currentAccount = await getStaffAppAccountByLinkedStaffProfileId(staffProfileId);

    if (!currentAccount) {
      return null;
    }

    const updatedAccount = {
      ...currentAccount,
      passwordHash: createPasswordHash(password),
      passwordSetAt: new Date().toISOString(),
    };

    await upsertDatabaseStaffAppAccount(updatedAccount);
    return updatedAccount;
  }

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
    passwordSetAt: new Date().toISOString(),
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
  const sql = getPostgresClient();

  if (sql) {
    try {
      const ensuredAccount = await ensureStaffAppAccountForLinkedStaffProfile(profile);
      const syncedAccount: StaffAppAccount = {
        ...ensuredAccount,
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

      await upsertDatabaseStaffAppAccount(syncedAccount);
      return syncedAccount;
    } catch (error) {
      logStaffAppStoreFallback(
        `syncStaffAppAccountFromLinkedStaffProfile(${profile.id})`,
        error,
      );
    }
  }

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

  await tryWriteStaffAppAccountStore(accounts);
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
  const sql = getPostgresClient();

  if (sql) {
    try {
      const linkedAccount = await getDatabaseStaffAppAccountByLinkedStaffProfileId(profile.id);
      const emailMatchedAccount = await getDatabaseStaffAppAccountByEmail(profile.email);
      const currentAccount = linkedAccount ?? emailMatchedAccount;
      const createdAccount = createStaffAppAccountFromLinkedStaffProfile(profile, {
        passwordHash: currentAccount?.passwordHash,
        isActive: currentAccount?.isActive ?? true,
        mustCompleteOnboarding: currentAccount?.mustCompleteOnboarding ?? false,
        passwordSetAt: currentAccount?.passwordSetAt ?? null,
        activatedAt: currentAccount?.activatedAt ?? null,
        createdFromApplicationId: currentAccount?.createdFromApplicationId ?? null,
      });
      const nextAccount: StaffAppAccount = currentAccount
        ? {
            ...currentAccount,
            ...createdAccount,
            id: currentAccount.id,
            lastLoginAt: currentAccount.lastLoginAt ?? null,
          }
        : createdAccount;

      await upsertDatabaseStaffAppAccount(nextAccount);
      return nextAccount;
    } catch (error) {
      logStaffAppStoreFallback(
        `ensureStaffAppAccountForLinkedStaffProfile(${profile.id})`,
        error,
      );
    }
  }

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
    await tryWriteStaffAppAccountStore(accounts);
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
    await tryWriteStaffAppAccountStore(accounts);
    return nextAccount;
  }

  const createdAccount = createStaffAppAccountFromLinkedStaffProfile(profile);
  accounts.push(createdAccount);
  await tryWriteStaffAppAccountStore(accounts);
  return createdAccount;
}

export async function createPendingStaffAppAccountForLinkedStaffProfile(profile: {
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
  createdFromApplicationId?: string | null;
}) {
  const sql = getPostgresClient();

  if (sql) {
    const currentAccount =
      (await getDatabaseStaffAppAccountByLinkedStaffProfileId(profile.id)) ??
      (await getDatabaseStaffAppAccountByEmail(profile.email));
    const pendingAccount = createStaffAppAccountFromLinkedStaffProfile(profile, {
      createdFromApplicationId: profile.createdFromApplicationId ?? null,
      passwordHash: "",
      isActive: false,
      mustCompleteOnboarding: true,
      passwordSetAt: null,
      activatedAt: null,
    });
    const nextAccount: StaffAppAccount = currentAccount
      ? {
          ...currentAccount,
          ...pendingAccount,
          id: currentAccount.id,
          lastLoginAt: currentAccount.lastLoginAt ?? null,
        }
      : pendingAccount;

    await upsertDatabaseStaffAppAccount(nextAccount);
    return nextAccount;
  }

  const accounts = await readStaffAppAccountStore();
  const accountIndex = accounts.findIndex(
    (account) =>
      account.linkedStaffProfileId === profile.id ||
      account.email.toLowerCase() === profile.email.toLowerCase(),
  );
  const pendingAccount = createStaffAppAccountFromLinkedStaffProfile(profile, {
    createdFromApplicationId: profile.createdFromApplicationId ?? null,
    passwordHash: "",
    isActive: false,
    mustCompleteOnboarding: true,
    passwordSetAt: null,
    activatedAt: null,
  });

  if (accountIndex === -1) {
    accounts.push(pendingAccount);
  } else {
    accounts[accountIndex] = {
      ...accounts[accountIndex],
      ...pendingAccount,
      id: accounts[accountIndex].id,
    };
  }

  await tryWriteStaffAppAccountStore(accounts);
  return accountIndex === -1 ? pendingAccount : accounts[accountIndex];
}

export async function activateStaffAppAccountById(accountId: string, password: string) {
  const sql = getPostgresClient();

  if (sql) {
    const currentAccount = await getStaffAppAccountById(accountId);

    if (!currentAccount) {
      return null;
    }

    const now = new Date().toISOString();
    const activatedAccount = {
      ...currentAccount,
      passwordHash: createPasswordHash(password),
      isActive: true,
      mustCompleteOnboarding: true,
      passwordSetAt: now,
      activatedAt: now,
    };

    await upsertDatabaseStaffAppAccount(activatedAccount);
    return activatedAccount;
  }

  const accounts = await readStaffAppAccountStore();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);

  if (accountIndex === -1) {
    return null;
  }

  const now = new Date().toISOString();
  accounts[accountIndex] = {
    ...accounts[accountIndex],
    passwordHash: createPasswordHash(password),
    isActive: true,
    mustCompleteOnboarding: true,
    passwordSetAt: now,
    activatedAt: now,
  };

  await writeStaffAppAccountStore(accounts);
  return accounts[accountIndex];
}

export async function markStaffAppAccountOnboardingCompleted(accountId: string) {
  const sql = getPostgresClient();

  if (sql) {
    const currentAccount = await getStaffAppAccountById(accountId);

    if (!currentAccount) {
      return null;
    }

    const updatedAccount = {
      ...currentAccount,
      mustCompleteOnboarding: false,
    };

    await upsertDatabaseStaffAppAccount(updatedAccount);
    return updatedAccount;
  }

  const accounts = await readStaffAppAccountStore();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);

  if (accountIndex === -1) {
    return null;
  }

  accounts[accountIndex] = {
    ...accounts[accountIndex],
    mustCompleteOnboarding: false,
  };

  await writeStaffAppAccountStore(accounts);
  return accounts[accountIndex];
}

export async function touchStaffAppAccountLastLogin(accountId: string) {
  const sql = getPostgresClient();

  if (sql) {
    try {
      const currentAccount = await getStaffAppAccountById(accountId);

      if (!currentAccount) {
        return null;
      }

      const updatedAccount = {
        ...currentAccount,
        lastLoginAt: new Date().toISOString(),
      };

      await upsertDatabaseStaffAppAccount(updatedAccount);
      return updatedAccount;
    } catch (error) {
      logStaffAppStoreFallback(`touchStaffAppAccountLastLogin(${accountId})`, error);
    }
  }

  const accounts = await getFallbackStaffAppAccounts();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);

  if (accountIndex === -1) {
    return null;
  }

  accounts[accountIndex] = {
    ...accounts[accountIndex],
    lastLoginAt: new Date().toISOString(),
  };

  await tryWriteStaffAppAccountStore(accounts);
  return accounts[accountIndex];
}

export async function deleteStaffAppAccountsByLinkedStaffProfileId(staffProfileId: string) {
  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<StaffAppAccountRow[]>`
      select *
      from staff_app_accounts
      where linked_staff_profile_id = ${staffProfileId}
    `;

    if (rows.length === 0) {
      return [] as StaffAppAccount[];
    }

    await sql`
      delete from staff_app_accounts
      where linked_staff_profile_id = ${staffProfileId}
    `;

    return rows.map(mapStaffAppAccountRow);
  }

  const accounts = await readStaffAppAccountStore();
  const deletedAccounts = accounts.filter(
    (account) => account.linkedStaffProfileId === staffProfileId,
  );

  if (deletedAccounts.length === 0) {
    return [] as StaffAppAccount[];
  }

  await tryWriteStaffAppAccountStore(
    accounts.filter((account) => account.linkedStaffProfileId !== staffProfileId),
  );

  return deletedAccounts;
}
