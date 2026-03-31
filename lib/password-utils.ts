import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const hashPrefix = "scrypt";

function normalizePassword(value: string) {
  return value.trim();
}

export function createPasswordHash(password: string) {
  const normalizedPassword = normalizePassword(password);
  const salt = randomUUID();
  const hash = scryptSync(normalizedPassword, salt, 64).toString("hex");
  return `${hashPrefix}:${salt}:${hash}`;
}

export function verifyPasswordHash(password: string, storedHash: string) {
  const normalizedPassword = normalizePassword(password);
  const [prefix, salt, hash] = storedHash.split(":");

  if (prefix !== hashPrefix || !salt || !hash) {
    return false;
  }

  const candidateHash = scryptSync(normalizedPassword, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(candidateHash, "hex"), Buffer.from(hash, "hex"));
}

export function getSeedScmStaffPassword(email: string) {
  const localPart = email.split("@")[0] ?? "scm";
  const firstSegment = localPart.split(/[._-]/)[0] ?? localPart;
  return `${firstSegment.toLowerCase()}123`;
}
