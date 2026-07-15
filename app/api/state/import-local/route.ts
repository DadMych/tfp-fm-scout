import { NextResponse } from "next/server";
import { z } from "zod";
import { isUserId, requireUserId } from "@/lib/api-auth";
import { getDb } from "@/src/db/client.js";
import { importUserState, type DatasetKind, type StoredDataset, type UserStateSnapshot } from "@/src/db/user-state.js";

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

const importSchema = z.object({
  datasets: z
    .object({
      shortlist: datasetSchema.optional(),
      squad: datasetSchema.optional(),
    })
    .optional()
    .default({}),
  assistant: z
    .object({
      formationId: z.string(),
      budget: z.number(),
      useFull: z.boolean(),
    })
    .nullable()
    .optional()
    .default(null),
  watchList: z
    .array(
      z.object({
        identityKey: z.string(),
        status: z.enum(["watching", "pursue", "passed"]),
        note: z.string(),
        addedAt: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(req: Request) {
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

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import payload." }, { status: 400 });
  }

  const datasets: Partial<Record<DatasetKind, StoredDataset>> = {};
  if (parsed.data.datasets.shortlist) {
    datasets.shortlist = parsed.data.datasets.shortlist as StoredDataset;
  }
  if (parsed.data.datasets.squad) {
    datasets.squad = parsed.data.datasets.squad as StoredDataset;
  }

  const snapshot: UserStateSnapshot = {
    datasets,
    assistant: parsed.data.assistant ?? null,
    watchList: parsed.data.watchList ?? [],
  };

  await importUserState(db, userId, snapshot);
  return NextResponse.json({ ok: true });
}
