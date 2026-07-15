import { NextResponse } from "next/server";
import { z } from "zod";
import { isHostedAuthConfigured } from "@/auth";
import { getDb } from "@/src/db/client.js";
import { createUser, findUserByEmail, hashPassword } from "@/src/db/auth-store.js";

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().max(80).optional(),
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
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const existing = await findUserByEmail(db, parsed.data.email);
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await createUser(db, {
    email: parsed.data.email,
    passwordHash,
    name: parsed.data.name ?? null,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
