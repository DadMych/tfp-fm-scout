import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

export type Db = NeonHttpDatabase<typeof schema>;

let db: Db | null = null;

/** Module-scoped Drizzle client (doc 16 §2). Returns null when hosted DB is not configured. */
export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!db) {
    db = drizzle(neon(url), { schema });
  }
  return db;
}

export function requireDb(): Db {
  const conn = getDb();
  if (!conn) {
    throw new Error("DATABASE_URL is not configured — hosted mode is unavailable.");
  }
  return conn;
}
