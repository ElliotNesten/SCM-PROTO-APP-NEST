import { createHmac, timingSafeEqual } from "node:crypto";

const developmentFallbackSessionSecret = "scm-platform-prototype-dev-session-secret";

function getConfiguredSessionSecret() {
  return process.env.SCM_SESSION_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || "";
}

export function isSessionCookieConfigurationMissingInProduction() {
  return process.env.NODE_ENV === "production" && !getConfiguredSessionSecret();
}

export function isSessionCookieConfigurationAvailable() {
  return Boolean(getConfiguredSessionSecret()) || process.env.NODE_ENV !== "production";
}

export function getSessionCookieConfigurationNotice() {
  if (!isSessionCookieConfigurationMissingInProduction()) {
    return "";
  }

  return "Authentication is temporarily unavailable due to an environment configuration issue. Contact an administrator and try again shortly.";
}

export class SessionCookieConfigurationError extends Error {
  constructor() {
    super("SCM_SESSION_SECRET or AUTH_SECRET must be set in production.");
    this.name = "SessionCookieConfigurationError";
  }
}

function getSessionSecret() {
  const configuredSecret = getConfiguredSessionSecret();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return developmentFallbackSessionSecret;
}

export function encodeSignedSessionCookie(payload: object) {
  const sessionSecret = getSessionSecret();

  if (!sessionSecret) {
    throw new SessionCookieConfigurationError();
  }

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", sessionSecret)
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

export function decodeSignedSessionCookie<T>(value: string): T | null {
  const [body, signature, ...rest] = value.split(".");

  if (!body || !signature || rest.length > 0) {
    return null;
  }

  const sessionSecret = getSessionSecret();

  if (!sessionSecret) {
    return null;
  }

  const expectedSignature = createHmac("sha256", sessionSecret)
    .update(body)
    .digest("base64url");

  try {
    if (
      !timingSafeEqual(
        Buffer.from(signature, "utf8"),
        Buffer.from(expectedSignature, "utf8"),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
