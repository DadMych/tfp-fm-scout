import { NextResponse } from "next/server";
import { z } from "zod";
import { isUserId, requireUserId } from "@/lib/api-auth";
import { getDb } from "@/src/db/client.js";
import { saveUserWatchList } from "@/src/db/user-state.js";

const bodySchema = z.array(
  z.object({
    identityKey: z.string(),
    status: z.enum(["watching", "pursue", "passed"]),
    note: z.string(),
    addedAt: z.string(),
  }),
);

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!isUserId(userId)) return userId;

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
    return NextResponse.json({ error: "Invalid watch list." }, { status: 400 });
  }

  await saveUserWatchList(db, userId, parsed.data);
  return NextResponse.json({ ok: true });
}
