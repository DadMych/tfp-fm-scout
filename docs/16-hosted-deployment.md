# 16 — Hosted Deployment (Neon + Auth.js)

The concrete deployment plan for phase **P4** (doc 15). This doc pins the infrastructure
decisions that doc 02 left open ("any managed Postgres") now that the database exists:
a **Neon** Postgres project in `eu-central-1`. Where this doc conflicts with doc 02, this
doc wins — doc 02 has been amended to match.

> **Status:** P4 complete — hosted accounts, persistence E2E, and production deploy at
> **https://tfp-fm.vercel.app**. No outbound email (password reset deferred).

---

## 1. What is already provisioned

| Piece | Value |
|---|---|
| Database | **Neon Postgres**, project region `aws-eu-central-1` |
| Database name | `neondb` |
| Connection | **Pooled** connection string (PgBouncer, `-pooler` host) in `.env` as `DATABASE_URL` |
| TLS | `sslmode=require&channel_binding=require` — never weaken |

The connection string lives **only** in `.env` (gitignored) and in the deploy platform's
environment settings. `.env.example` documents the shape without secrets. If the string
ever leaks (pasted in a chat, committed, screenshotted), rotate the password in the Neon
console immediately — treat it like a password, because it is one.

### Why Neon (decision log)

| Property | Why it matters here |
|---|---|
| Serverless Postgres, scale-to-zero | Hobby-scale traffic costs ~nothing between sessions |
| Pooled endpoint built in | Next.js serverless functions open many short connections; PgBouncer absorbs that without us running infra |
| Branching | A database branch per preview deploy / migration test — try a Drizzle migration on a branch before `main` |
| Plain Postgres 16 wire protocol | Drizzle, pg-boss, and every doc 02/04 decision apply unchanged |

## 2. Connection rules (read before writing DB code)

1. **App queries → pooled string** (the `-pooler` host, what's in `.env`). Use
   `drizzle-orm` with the `postgres`/`neon-http` driver.
2. **Migrations and pg-boss → direct (unpooled) string.** PgBouncer in transaction mode
   breaks `LISTEN/NOTIFY` and long-lived locks. Get the direct string from the Neon
   console (same credentials, host without `-pooler`) and store it as
   `DATABASE_URL_UNPOOLED` when P4 starts.
3. One Drizzle client instance per process, module-scoped — no per-request `new Pool()`.
4. Every query goes through the `withUser(userId)` repository wrapper (doc 02
   multi-tenancy rule). No ad-hoc SQL in route handlers.

## 3. Auth: credentials + Google

**Decision (July 2026, project owner):** login is **email + password** and **Google
OAuth** via **Auth.js v5**. This amends doc 02's original "magic link + Discord" line —
password login is the lowest-friction option for the FM audience, and Google covers the
"no new password" crowd.

- **Providers:** `Credentials` (email + password, bcrypt/argon2 hash in the `users`
  table) and `Google`.
- **Sessions:** JWT strategy (no session table needed with serverless), `AUTH_SECRET`
  from `.env`.
- **Account linking:** match by verified email — a user who registered with a password
  and later clicks "Sign in with Google" on the same address lands in the same account.
- **Password reset:** deferred — no outbound email in v1 (no Resend, no sender domain).
  Users who forget a password create a new account or use Google when configured.
- Env vars: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (placeholders
  already in `.env`).

## 4. Per-user data model (delta to doc 04)

Everything the local build keeps in `localStorage` gets a `user_id`-scoped table. The
store seam (`lib/store.tsx`) is the designed insertion point — screens don't change.

```
users            id, email, password_hash (nullable for OAuth-only), name, created_at
accounts         Auth.js OAuth account rows (provider, provider_account_id → user_id)
datasets         id, user_id, kind (shortlist|squad), label, source, imported_at,
                 masked_share, engine_version, status (ready|failed)
players          id, dataset_id, ...normalized Player fields (doc 04), attrs JSONB
watch_entries    user_id, identity_key, status, note, created_at   ← tfp.watch.v2
assistant_runs   user_id, formation_id, budget, use_full           ← tfp.assistant.v1
```

- Local → hosted migration: on first login the client offers to push its `localStorage`
  datasets and watch list up (one-time import through the normal upload path).
- Scores are **not** stored in v1: `buildScores` is pure and fast, and doc 02's
  rescore-on-engine-bump gets simpler when scores are always derived. Revisit only if
  profiling says otherwise (doc 02 allows either).

## 5. Deploy shape

| Piece | Choice |
|---|---|
| Host | **Vercel** (Next.js native; preview deploys pair with Neon branches). Docker/container host remains the documented fallback per doc 02 |
| DB | Neon (this doc) |
| File parsing | Stays **client-side in the Web Worker** for v1 hosted — the P3 worker already does parse + score off-thread; the server receives *normalized players JSON*, not raw 80 MB files. Server-side streaming parse (doc 02 pipeline) is deferred until share-links/reprocessing demand canonical raw files |
| Raw file storage | Deferred with it (no S3 in v1) |
| Background jobs | Deferred with it (no pg-boss in v1; nothing long-running remains server-side) |

This is deliberately smaller than doc 02's full topology: doc 02 describes the
destination; this doc describes **v1 hosted** — the smallest deploy where accounts and
per-user persistence work. The doc 02 pipeline (S3 + worker + streaming parse) layers on
later without moving the seam again.

## 6. Environment matrix

| Var | Local dev | Vercel |
|---|---|---|
| `DATABASE_URL` | Neon pooled string (in `.env`) | Project env var |
| `DATABASE_URL_UNPOOLED` | Neon direct string (add at P4 start) | Project env var (migrations run from CI) |
| `AUTH_SECRET` | `openssl rand -base64 32` | Separate value per environment |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth client "TFP FM dev" (localhost callback) | OAuth client "TFP FM" (prod callback) |
| `AUTH_URL` | Optional in dev (`trustHost` covers Vercel previews) | Production origin if needed |

## 7. Order of work when P4 opens

1. Drizzle + schema from §4, migrations against a Neon branch, then `main`.
2. Auth.js: Credentials + Google, JWT sessions, register/login screens in Broadsheet voice.
3. Store seam swap: `lib/store.tsx` reads/writes repositories via API routes when a
   session exists; `localStorage` remains the logged-out mode.
4. One-time local → account migration prompt.
5. Playwright E2E: register → upload → relogin on a "second device" (fresh context) →
   data still there.

**AC:** two different Google accounts see fully isolated data (tenancy test); a
password user and the same email via Google land in one account; logged-out mode still
works entirely offline exactly as today.

## 8. Vercel deploy checklist

1. **Neon `main` branch** has migrations applied: `DATABASE_URL_UNPOOLED=… pnpm db:migrate`.
2. **GitHub** [github.com/DadMych/tfp-fm-scout](https://github.com/DadMych/tfp-fm-scout) connected to Vercel project `tfp-fm`; `vercel.json` sets `pnpm install` + `pnpm build`.
3. **Set production env vars** from §6 (pooled `DATABASE_URL` for runtime; unpooled only for migrate CI / `.github/workflows/migrate.yml`).
4. **Google OAuth** prod client: authorized redirect `https://<your-domain>/api/auth/callback/google` (optional until configured).
5. **Deploy:** `vercel --prod` (or connect the GitHub repo for automatic deploys).
6. **Smoke test:** register → upload sample → sign out → sign in → data on Scout desk.

Logged-out visitors still get the full local-first app (IndexedDB) when no session is present.
