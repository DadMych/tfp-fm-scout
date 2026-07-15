import { NextResponse } from "next/server";
import { z } from "zod";
import { isUserId, requireUserId } from "@/lib/api-auth";
import { getDb } from "@/src/db/client.js";
import { saveUserAssistantRun } from "@/src/db/user-state.js";

const bodySchema = z.object({
  formationId: z.string(),
  budget: z.number(),
  useFull: z.boolean(),
  squadCap: z.number().int().min(11).max(40).optional(),
});

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
    return NextResponse.json({ error: "Invalid assistant settings." }, { status: 400 });
  }

  await saveUserAssistantRun(db, userId, parsed.data);
  return NextResponse.json({ ok: true });
}
