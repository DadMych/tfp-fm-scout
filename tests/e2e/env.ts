import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

/** Load `.env` into `process.env` when Playwright runs outside Next.js. */
export function loadDotEnv(): void {
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8");
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
    // Offline E2E does not require `.env`.
  }
}

export function isHostedE2EEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL && effectiveAuthSecret());
}

/** Playwright injects a local-only secret when DATABASE_URL is set but AUTH_SECRET is not. */
export function effectiveAuthSecret(): string | undefined {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  return process.env.DATABASE_URL ? "playwright-e2e-local-only-secret" : undefined;
}

export function applyHostedE2EEnv(): void {
  loadDotEnv();
  if (process.env.DATABASE_URL && !process.env.AUTH_SECRET?.trim()) {
    process.env.AUTH_SECRET = "playwright-e2e-local-only-secret";
  }
}
