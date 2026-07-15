import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createUser, findOAuthAccount, hashPassword } from "../../src/db/auth-store.js";
import { getDb } from "../../src/db/client.js";
import { linkOAuthUser } from "../../src/db/oauth-link.js";

function loadDotEnv(): void {
  try {
    const raw = readFileSync(resolve(import.meta.dirname, "../../.env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // Optional for offline runs.
  }
}

loadDotEnv();

const hosted = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hosted)("oauth account linking", () => {
  it(
    "links a Google account to an existing password user by email",
    async () => {
      const db = getDb();
      if (!db) throw new Error("DATABASE_URL is not configured.");

      const stamp = Date.now();
      const email = `oauth-link-${stamp}@tfp-fm.test`;
      const providerAccountId = `google-${stamp}`;

      const passwordUser = await createUser(db, {
        email,
        passwordHash: await hashPassword("testpass123"),
        name: "Password User",
      });

      const linkedId = await linkOAuthUser(db, {
        email,
        provider: "google",
        providerAccountId,
        type: "oidc",
        name: "Google Name",
      });

      expect(linkedId).toBe(passwordUser.id);

      const account = await findOAuthAccount(db, "google", providerAccountId);
      expect(account?.userId).toBe(passwordUser.id);
    },
    15_000,
  );
});
