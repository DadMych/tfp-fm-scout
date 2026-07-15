import { NextResponse } from "next/server";
import { z } from "zod";
import { isHostedAuthConfigured } from "@/auth";
import { findUserById, hashPassword, updateUserPassword } from "@/src/db/auth-store.js";
import { getDb } from "@/src/db/client.js";
import { verifyPasswordResetToken } from "@/src/db/password-reset.js";

const bodySchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  if (!isHostedAuthConfigured()) {
    return NextResponse.json({ error: "Hosted auth is not configured." }, { status: 503 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  const claims = verifyPasswordResetToken(parsed.data.token);
  if (!claims) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  const user = await findUserById(db, claims.userId);
  if (!user || user.email.toLowerCase() !== claims.email) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await updateUserPassword(db, user.id, passwordHash);

  return NextResponse.json({ ok: true });
}
