import { NextResponse } from "next/server";
import { isUserId, requireUserId } from "@/lib/api-auth";
import { getDb } from "@/src/db/client.js";
import { loadUserState } from "@/src/db/user-state.js";

export async function GET() {
  const userId = await requireUserId();
  if (!isUserId(userId)) return userId;

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const state = await loadUserState(db, userId);
  return NextResponse.json(state);
}
