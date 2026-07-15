import { NextResponse } from "next/server";
import { z } from "zod";
import { isUserId, requireUserId } from "@/lib/api-auth";
import { getDb } from "@/src/db/client.js";
import {
  deleteUserDataset,
  saveUserDataset,
  type DatasetKind,
  type StoredDataset,
} from "@/src/db/user-state.js";

const kindSchema = z.enum(["shortlist", "squad"]);

const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().nullable(),
  positions: z.array(z.string()),
  attrs: z.record(z.string(), z.unknown()),
  club: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
  heightCm: z.number().nullable().optional(),
  foot: z.enum(["Right", "Left", "Either"]).nullable().optional(),
  scoutGrade: z.string().nullable().optional(),
});

const datasetSchema = z.object({
  label: z.string(),
  source: z.string(),
  players: z.array(playerSchema),
  maskedShare: z.number(),
  importedAt: z.string(),
});

function parseKind(raw: string): DatasetKind | NextResponse {
  const parsed = kindSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dataset kind." }, { status: 400 });
  }
  return parsed.data;
}

export async function PUT(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const userId = await requireUserId();
  if (!isUserId(userId)) return userId;

  const kind = parseKind((await ctx.params).kind);
  if (typeof kind !== "string") return kind;

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

  const parsed = datasetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dataset payload." }, { status: 400 });
  }

  await saveUserDataset(db, userId, kind, parsed.data as StoredDataset);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const userId = await requireUserId();
  if (!isUserId(userId)) return userId;

  const kind = parseKind((await ctx.params).kind);
  if (typeof kind !== "string") return kind;

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  await deleteUserDataset(db, userId, kind);
  return NextResponse.json({ ok: true });
}
