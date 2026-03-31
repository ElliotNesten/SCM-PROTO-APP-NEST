import { createHmac, timingSafeEqual } from "node:crypto";

const fallbackSessionSecret = "scm-platform-prototype-session-secret";

function getSessionSecret() {
  return process.env.SCM_SESSION_SECRET || process.env.AUTH_SECRET || fallbackSessionSecret;
}

export function encodeSignedSessionCookie(payload: object) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

export function decodeSignedSessionCookie<T>(value: string): T | null {
  const [body, signature, ...rest] = value.split(".");

  if (!body || !signature || rest.length > 0) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getSessionSecret())
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
