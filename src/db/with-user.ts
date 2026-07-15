import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import * as schema from "./schema.js";

/** Scoped repository wrapper — every hosted query carries user_id (doc 02 / doc 16). */
export function withUser(db: Db, userId: string) {
  return {
    userId,

    async getDataset(kind: "shortlist" | "squad") {
      const rows = await db
        .select()
        .from(schema.datasets)
        .where(and(eq(schema.datasets.userId, userId), eq(schema.datasets.kind, kind)))
        .limit(1);
      return rows[0] ?? null;
    },

    async listWatchEntries() {
      return db.select().from(schema.watchEntries).where(eq(schema.watchEntries.userId, userId));
    },

    async getAssistantRun() {
      const rows = await db
        .select()
        .from(schema.assistantRuns)
        .where(eq(schema.assistantRuns.userId, userId))
        .limit(1);
      return rows[0] ?? null;
    },
  };
}
