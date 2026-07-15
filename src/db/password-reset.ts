import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "password-reset";
const TTL_MS = 60 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET is not configured.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function baseUrl(): string {
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function createPasswordResetToken(userId: string, email: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const body = `${PURPOSE}|${userId}|${email.toLowerCase()}|${expiresAt}`;
  return `${Buffer.from(body, "utf8").toString("base64url")}.${sign(body)}`;
}

export function verifyPasswordResetToken(
  token: string,
): { userId: string; email: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const [purpose, userId, email, expiresRaw] = body.split("|");
  if (purpose !== PURPOSE || !userId || !email || !expiresRaw) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return { userId, email };
}

export function passwordResetUrl(token: string): string {
  return `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}
