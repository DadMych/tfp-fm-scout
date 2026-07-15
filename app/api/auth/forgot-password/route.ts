import { NextResponse } from "next/server";
import { z } from "zod";
import { isHostedAuthConfigured } from "@/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { findUserByEmail } from "@/src/db/auth-store.js";
import { getDb } from "@/src/db/client.js";
import { createPasswordResetToken, passwordResetUrl } from "@/src/db/password-reset.js";

const bodySchema = z.object({
  email: z.email(),
});

const GENERIC =
  "If an account exists for that address, we sent a link to reset your password.";

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
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const user = await findUserByEmail(db, parsed.data.email);
  if (user?.passwordHash) {
    try {
      const token = createPasswordResetToken(user.id, user.email);
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: passwordResetUrl(token),
      });
    } catch {
      return NextResponse.json({ error: "Could not send reset email. Try again later." }, { status: 503 });
    }
  }

  return NextResponse.json({ message: GENERIC });
}
