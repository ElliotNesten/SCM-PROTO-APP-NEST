import { createHmac, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureProductionStorageSchema,
  getPostgresClient,
} from "@/lib/postgres";
import type {
  PasswordSetupTokenRecord,
  PasswordSetupTokenVerificationResult,
} from "@/types/job-applications";

const storeDirectory = path.join(process.cwd(), "data");
const storePath = path.join(storeDirectory, "password-setup-token-store.json");
const tokenLifetimeMs = 24 * 60 * 60 * 1000;
const fallbackTokenSecret = "scm-platform-prototype-password-setup-secret";

function getPasswordSetupTokenSecret() {
  return (
    process.env.SCM_PASSWORD_SETUP_TOKEN_SECRET ||
    process.env.SCM_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    fallbackTokenSecret
  );
}

function hashPasswordSetupToken(token: string) {
  return createHmac("sha256", getPasswordSetupTokenSecret()).update(token).digest("hex");
}

async function ensurePasswordSetupTokenStore() {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(storeDirectory, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify([], null, 2), "utf8");
  }
}

async function readPasswordSetupTokenStore() {
  await ensurePasswordSetupTokenStore();
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw) as PasswordSetupTokenRecord[];
}

async function writePasswordSetupTokenStore(tokens: PasswordSetupTokenRecord[]) {
  await fs.writeFile(storePath, JSON.stringify(tokens, null, 2), "utf8");
}

type PasswordSetupTokenRow = {
  id: string;
  email: string;
  subject_type: "staffApp" | "scmStaff" | null;
  staff_profile_id: string;
  staff_app_account_id: string;
  scm_staff_profile_id: string | null;
  application_id: string | null;
  token_hash: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  invalidated_at: string | null;
};

function mapPasswordSetupTokenRow(row: PasswordSetupTokenRow): PasswordSetupTokenRecord {
  return {
    id: row.id,
    email: row.email,
    subjectType: row.subject_type ?? "staffApp",
    staffProfileId: row.staff_profile_id,
    staffAppAccountId: row.staff_app_account_id,
    scmStaffProfileId: row.scm_staff_profile_id,
    applicationId: row.application_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    invalidatedAt: row.invalidated_at,
  };
}

function getVerificationState(record: PasswordSetupTokenRecord | null) {
  if (!record) {
    return "missing" as const;
  }

  if (record.invalidatedAt) {
    return "invalidated" as const;
  }

  if (record.consumedAt) {
    return "consumed" as const;
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    return "expired" as const;
  }

  return "valid" as const;
}

export function getScmStaffPasswordSetupAccountId(profileId: string) {
  return `scm-staff:${profileId}`;
}

export async function createPasswordSetupToken(input: {
  email: string;
  staffProfileId: string;
  staffAppAccountId: string;
  subjectType?: "staffApp" | "scmStaff";
  scmStaffProfileId?: string | null;
  applicationId?: string | null;
}) {
  const sql = getPostgresClient();
  const subjectType = input.subjectType ?? "staffApp";
  const scmStaffProfileId =
    subjectType === "scmStaff"
      ? input.scmStaffProfileId?.trim() || input.staffProfileId
      : null;

  if (sql) {
    await ensureProductionStorageSchema();
    const rawToken = randomBytes(32).toString("hex");
    const now = new Date();
    const invalidatedAt = now.toISOString();
    const issuedToken: PasswordSetupTokenRecord = {
      id: `pst-${randomUUID().slice(0, 8)}`,
      email: input.email.trim(),
      subjectType,
      staffProfileId: input.staffProfileId,
      staffAppAccountId: input.staffAppAccountId,
      scmStaffProfileId,
      applicationId: input.applicationId ?? null,
      tokenHash: hashPasswordSetupToken(rawToken),
      createdAt: invalidatedAt,
      expiresAt: new Date(now.getTime() + tokenLifetimeMs).toISOString(),
      consumedAt: null,
      invalidatedAt: null,
    };

    await sql`
      update password_setup_tokens
      set invalidated_at = coalesce(invalidated_at, ${invalidatedAt})
      where staff_app_account_id = ${input.staffAppAccountId}
        and invalidated_at is null
        and consumed_at is null
    `;
    await sql`
      insert into password_setup_tokens (
        id, email, email_lower, subject_type, staff_profile_id, staff_app_account_id,
        scm_staff_profile_id, application_id, token_hash, created_at, expires_at,
        consumed_at, invalidated_at
      ) values (
        ${issuedToken.id},
        ${issuedToken.email},
        ${issuedToken.email.toLowerCase()},
        ${issuedToken.subjectType ?? "staffApp"},
        ${issuedToken.staffProfileId},
        ${issuedToken.staffAppAccountId},
        ${issuedToken.scmStaffProfileId ?? null},
        ${issuedToken.applicationId},
        ${issuedToken.tokenHash},
        ${issuedToken.createdAt},
        ${issuedToken.expiresAt},
        ${issuedToken.consumedAt},
        ${issuedToken.invalidatedAt}
      )
    `;

    return {
      token: rawToken,
      record: issuedToken,
    };
  }

  const tokens = await readPasswordSetupTokenStore();
  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();
  const issuedToken: PasswordSetupTokenRecord = {
    id: `pst-${randomUUID().slice(0, 8)}`,
    email: input.email.trim(),
    subjectType,
    staffProfileId: input.staffProfileId,
    staffAppAccountId: input.staffAppAccountId,
    scmStaffProfileId,
    applicationId: input.applicationId ?? null,
    tokenHash: hashPasswordSetupToken(rawToken),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + tokenLifetimeMs).toISOString(),
    consumedAt: null,
    invalidatedAt: null,
  };

  const nextTokens = tokens.map((token) =>
    token.staffAppAccountId === input.staffAppAccountId &&
    !token.invalidatedAt &&
    !token.consumedAt
      ? {
          ...token,
          invalidatedAt: now.toISOString(),
        }
      : token,
  );

  nextTokens.unshift(issuedToken);
  await writePasswordSetupTokenStore(nextTokens);

  return {
    token: rawToken,
    record: issuedToken,
  };
}

export async function verifyPasswordSetupToken(
  rawToken: string,
): Promise<PasswordSetupTokenVerificationResult> {
  const normalizedToken = rawToken.trim();

  if (!normalizedToken) {
    return {
      state: "missing",
      record: null,
    };
  }

  const sql = getPostgresClient();

  if (sql) {
    await ensureProductionStorageSchema();
    const rows = await sql<PasswordSetupTokenRow[]>`
      select *
      from password_setup_tokens
      where token_hash = ${hashPasswordSetupToken(normalizedToken)}
      limit 1
    `;
    const record = rows[0] ? mapPasswordSetupTokenRow(rows[0]) : null;

    return {
      state: getVerificationState(record),
      record,
    };
  }

  const tokens = await readPasswordSetupTokenStore();
  const record =
    tokens.find((token) => token.tokenHash === hashPasswordSetupToken(normalizedToken)) ?? null;

  return {
    state: getVerificationState(record),
    record,
  };
}

export async function invalidatePasswordSetupToken(rawToken: string) {
  const normalizedToken = rawToken.trim();

  if (!normalizedToken) {
    return null;
  }

  const sql = getPostgresClient();

  if (sql) {
    const verification = await verifyPasswordSetupToken(normalizedToken);

    if (!verification.record) {
      return null;
    }

    const nextInvalidatedAt =
      verification.record.invalidatedAt ?? new Date().toISOString();
    await ensureProductionStorageSchema();
    await sql`
      update password_setup_tokens
      set invalidated_at = ${nextInvalidatedAt}
      where id = ${verification.record.id}
    `;

    return {
      ...verification.record,
      invalidatedAt: nextInvalidatedAt,
    };
  }

  const tokens = await readPasswordSetupTokenStore();
  const tokenIndex = tokens.findIndex(
    (token) => token.tokenHash === hashPasswordSetupToken(normalizedToken),
  );

  if (tokenIndex === -1) {
    return null;
  }

  tokens[tokenIndex] = {
    ...tokens[tokenIndex],
    invalidatedAt: tokens[tokenIndex].invalidatedAt ?? new Date().toISOString(),
  };

  await writePasswordSetupTokenStore(tokens);
  return tokens[tokenIndex];
}

export async function consumePasswordSetupToken(rawToken: string) {
  const normalizedToken = rawToken.trim();

  if (!normalizedToken) {
    return null;
  }

  const sql = getPostgresClient();

  if (sql) {
    const verification = await verifyPasswordSetupToken(normalizedToken);

    if (verification.state !== "valid" || !verification.record) {
      return null;
    }

    const consumedAt = new Date().toISOString();
    await ensureProductionStorageSchema();
    await sql`
      update password_setup_tokens
      set consumed_at = ${consumedAt}
      where id = ${verification.record.id}
    `;

    return {
      ...verification.record,
      consumedAt,
    };
  }

  const verification = await verifyPasswordSetupToken(normalizedToken);

  if (verification.state !== "valid" || !verification.record) {
    return null;
  }

  const tokens = await readPasswordSetupTokenStore();
  const tokenIndex = tokens.findIndex(
    (token) => token.id === verification.record?.id,
  );

  if (tokenIndex === -1) {
    return null;
  }

  tokens[tokenIndex] = {
    ...tokens[tokenIndex],
    consumedAt: new Date().toISOString(),
  };

  await writePasswordSetupTokenStore(tokens);
  return tokens[tokenIndex];
}
