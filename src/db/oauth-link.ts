import {
  createUser,
  findOAuthAccount,
  findUserByEmail,
  linkOAuthAccount,
} from "./auth-store.js";
import type { Db } from "./client.js";

export interface OAuthLinkInput {
  readonly email: string;
  readonly provider: string;
  readonly providerAccountId: string;
  readonly type: string;
  readonly name?: string | null;
}

/** Match OAuth sign-in to an existing user by verified email (doc 16 §3). */
export async function linkOAuthUser(db: Db, input: OAuthLinkInput): Promise<string> {
  const email = input.email.toLowerCase();

  const existing = await findOAuthAccount(db, input.provider, input.providerAccountId);
  if (existing) return existing.userId;

  let row = await findUserByEmail(db, email);
  if (!row) {
    row = await createUser(db, { email, name: input.name ?? null });
  }

  await linkOAuthAccount(db, {
    userId: row.id,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    type: input.type,
  });

  return row.id;
}
