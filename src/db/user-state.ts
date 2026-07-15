import { and, eq } from "drizzle-orm";
import type { Player } from "../domain/player.js";
import { ENGINE_VERSION } from "../domain/engine-version.js";
import type { Db } from "./client.js";
import * as schema from "./schema.js";

export type DatasetKind = "shortlist" | "squad";

export interface StoredDataset {
  readonly label: string;
  readonly source: string;
  readonly players: Player[];
  readonly maskedShare: number;
  readonly importedAt: string;
}

export interface StoredAssistantRun {
  readonly formationId: string;
  readonly budget: number;
  readonly useFull: boolean;
  readonly squadCap?: number | undefined;
}

export interface UserStateSnapshot {
  readonly datasets: Partial<Record<DatasetKind, StoredDataset>>;
  readonly assistant: StoredAssistantRun | null;
  readonly watchList: readonly {
    readonly identityKey: string;
    readonly status: "watching" | "pursue" | "passed";
    readonly note: string;
    readonly addedAt: string;
  }[];
}

function rowToPlayer(row: typeof schema.players.$inferSelect): Player {
  const extras: {
    club?: string;
    nationality?: string;
    value?: number;
    heightCm?: number;
    foot?: NonNullable<Player["foot"]>;
    scoutGrade?: string;
  } = {};
  if (row.club != null) extras.club = row.club;
  if (row.nationality != null) extras.nationality = row.nationality;
  if (row.value != null) extras.value = row.value;
  if (row.heightCm != null) extras.heightCm = row.heightCm;
  if (row.foot != null) extras.foot = row.foot as NonNullable<Player["foot"]>;
  if (row.scoutGrade != null) extras.scoutGrade = row.scoutGrade;
  return {
    id: row.rowId,
    name: row.name,
    age: row.age,
    positions: row.positions,
    attrs: row.attrs,
    ...extras,
  };
}

function playerToRow(datasetId: string, p: Player): typeof schema.players.$inferInsert {
  return {
    datasetId,
    rowId: p.id,
    name: p.name,
    age: p.age,
    positions: [...p.positions],
    attrs: p.attrs,
    club: p.club ?? null,
    nationality: p.nationality ?? null,
    value: p.value != null ? Math.round(p.value) : null,
    heightCm: p.heightCm != null ? Math.round(p.heightCm) : null,
    foot: p.foot ?? null,
    scoutGrade: p.scoutGrade ?? null,
  };
}

const BATCH = 500;

export async function loadUserState(db: Db, userId: string): Promise<UserStateSnapshot> {
  const datasets: Partial<Record<DatasetKind, StoredDataset>> = {};

  for (const kind of ["shortlist", "squad"] as const) {
    const rows = await db
      .select()
      .from(schema.datasets)
      .where(and(eq(schema.datasets.userId, userId), eq(schema.datasets.kind, kind)))
      .limit(1);
    const meta = rows[0];
    if (!meta) continue;

    const playerRows = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.datasetId, meta.id));

    datasets[kind] = {
      label: meta.label,
      source: meta.source,
      importedAt: meta.importedAt.toISOString(),
      maskedShare: meta.maskedShare,
      players: playerRows.map(rowToPlayer),
    };
  }

  const watchRows = await db
    .select()
    .from(schema.watchEntries)
    .where(eq(schema.watchEntries.userId, userId));

  const assistantRows = await db
    .select()
    .from(schema.assistantRuns)
    .where(eq(schema.assistantRuns.userId, userId))
    .limit(1);

  const assistant = assistantRows[0] ?? null;

  return {
    datasets,
    assistant: assistant
      ? {
          formationId: assistant.formationId,
          budget: assistant.budget,
          useFull: assistant.useFull,
          squadCap: assistant.squadCap ?? 25,
        }
      : null,
    watchList: watchRows.map((w) => ({
      identityKey: w.identityKey,
      status: w.status,
      note: w.note,
      addedAt: w.createdAt.toISOString(),
    })),
  };
}

export async function saveUserDataset(
  db: Db,
  userId: string,
  kind: DatasetKind,
  dataset: StoredDataset,
): Promise<void> {
  const importedAt = new Date(dataset.importedAt);

  const existing = await db
    .select({ id: schema.datasets.id })
    .from(schema.datasets)
    .where(and(eq(schema.datasets.userId, userId), eq(schema.datasets.kind, kind)))
    .limit(1);

  let datasetId = existing[0]?.id;

  if (datasetId) {
    await db
      .update(schema.datasets)
      .set({
        label: dataset.label,
        source: dataset.source,
        importedAt,
        maskedShare: dataset.maskedShare,
        engineVersion: ENGINE_VERSION,
        status: "ready",
      })
      .where(eq(schema.datasets.id, datasetId));
    await db.delete(schema.players).where(eq(schema.players.datasetId, datasetId));
  } else {
    const [row] = await db
      .insert(schema.datasets)
      .values({
        userId,
        kind,
        label: dataset.label,
        source: dataset.source,
        importedAt,
        maskedShare: dataset.maskedShare,
        engineVersion: ENGINE_VERSION,
        status: "ready",
      })
      .returning({ id: schema.datasets.id });
    datasetId = row!.id;
  }

  for (let i = 0; i < dataset.players.length; i += BATCH) {
    const chunk = dataset.players.slice(i, i + BATCH).map((p) => playerToRow(datasetId!, p));
    if (chunk.length > 0) await db.insert(schema.players).values(chunk);
  }
}

export async function deleteUserDataset(db: Db, userId: string, kind: DatasetKind): Promise<void> {
  await db
    .delete(schema.datasets)
    .where(and(eq(schema.datasets.userId, userId), eq(schema.datasets.kind, kind)));
}

export async function saveUserWatchList(
  db: Db,
  userId: string,
  list: UserStateSnapshot["watchList"],
): Promise<void> {
  await db.delete(schema.watchEntries).where(eq(schema.watchEntries.userId, userId));
  if (list.length === 0) return;

  await db.insert(schema.watchEntries).values(
    list.map((e) => ({
      userId,
      identityKey: e.identityKey,
      status: e.status,
      note: e.note,
      createdAt: new Date(e.addedAt),
    })),
  );
}

export async function saveUserAssistantRun(
  db: Db,
  userId: string,
  run: StoredAssistantRun,
): Promise<void> {
  await db
    .insert(schema.assistantRuns)
    .values({
      userId,
      formationId: run.formationId,
      budget: run.budget,
      useFull: run.useFull,
      squadCap: run.squadCap ?? 25,
    })
    .onConflictDoUpdate({
      target: schema.assistantRuns.userId,
      set: {
        formationId: run.formationId,
        budget: run.budget,
        useFull: run.useFull,
        squadCap: run.squadCap ?? 25,
      },
    });
}

export async function importUserState(
  db: Db,
  userId: string,
  snapshot: UserStateSnapshot,
): Promise<void> {
  for (const kind of ["shortlist", "squad"] as const) {
    const ds = snapshot.datasets[kind];
    if (ds) await saveUserDataset(db, userId, kind, ds);
  }
  await saveUserWatchList(db, userId, snapshot.watchList);
  if (snapshot.assistant) await saveUserAssistantRun(db, userId, snapshot.assistant);
}

export function userStateEmpty(snapshot: UserStateSnapshot): boolean {
  const hasDatasets = Boolean(snapshot.datasets.shortlist || snapshot.datasets.squad);
  return !hasDatasets && snapshot.assistant == null && snapshot.watchList.length === 0;
}
