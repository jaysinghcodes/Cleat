import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const NONCE_PATTERN = /^[0-9a-f]{64}$/i;
const USER_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newFeedNonce(): string {
  return randomBytes(32).toString("hex");
}

export function assertFeedSecret(secret: string): string {
  const value = secret.trim();
  if (value.length < 16) {
    throw new Error("ICS signing secret is too short.");
  }
  return value;
}

/** Token is `userId.nonce.mac`. The subscribe URL appends `.ics`. */
export function signFeedToken(userId: string, nonce: string, secret: string): string {
  const key = assertFeedSecret(secret);
  if (!USER_PATTERN.test(userId) || !NONCE_PATTERN.test(nonce)) {
    throw new Error("Calendar token parts are not valid.");
  }
  const payload = `${userId}.${nonce}`;
  const mac = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyFeedToken(
  token: string,
  secret: string,
): { userId: string; nonce: string } | null {
  const key = secret.trim();
  if (key.length < 16) return null;
  const trimmed = token.trim().replace(/\.ics$/i, "");
  const parts = trimmed.split(".");
  if (parts.length !== 3) return null;
  const [userId, nonce, mac] = parts;
  if (!userId || !nonce || !mac) return null;
  if (!USER_PATTERN.test(userId) || !NONCE_PATTERN.test(nonce)) return null;
  const expected = createHmac("sha256", key).update(`${userId}.${nonce}`).digest("base64url");
  const actual = Buffer.from(mac);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return null;
  if (!timingSafeEqual(actual, wanted)) return null;
  return { userId, nonce };
}
