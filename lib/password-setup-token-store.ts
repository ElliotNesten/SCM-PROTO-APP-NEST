import { createHmac, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

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

export async function createPasswordSetupToken(input: {
  email: string;
  staffProfileId: string;
  staffAppAccountId: string;
  applicationId?: string | null;
}) {
  const tokens = await readPasswordSetupTokenStore();
  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();
  const issuedToken: PasswordSetupTokenRecord = {
    id: `pst-${randomUUID().slice(0, 8)}`,
    email: input.email.trim(),
    staffProfileId: input.staffProfileId,
    staffAppAccountId: input.staffAppAccountId,
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
