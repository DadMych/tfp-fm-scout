import { and, eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import type { Db } from "./client.js";
import * as schema from "./schema.js";

const ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function findUserByEmail(db: Db, email: string) {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(db: Db, id: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(
  db: Db,
  input: { email: string; passwordHash?: string | null; name?: string | null },
) {
  const [row] = await db
    .insert(schema.users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash ?? null,
      name: input.name ?? null,
    })
    .returning();
  return row!;
}

export async function findOAuthAccount(db: Db, provider: string, providerAccountId: string) {
  const rows = await db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.provider, provider),
        eq(schema.accounts.providerAccountId, providerAccountId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function linkOAuthAccount(
  db: Db,
  input: { userId: string; provider: string; providerAccountId: string; type: string },
) {
  await db.insert(schema.accounts).values({
    userId: input.userId,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    type: input.type,
  });
}
