# 02 — Architecture

Hosted multi-user web app. Users upload FM26 exports; we parse, store, and serve analysis. Built to be operable by a tiny team: one deployable web process + Postgres + object storage, no microservices.

> **Current stage (July 2026):** the shipped build is a **local-first Next.js app** — parsing and scoring run in the browser; datasets persist in `localStorage`. The stack table below is the **destination** architecture (doc 15, phase P4). The UI follows doc 09's **Broadsheet** direction with hand-rolled CSS, not Tailwind/shadcn.

## Stack (decided — do not relitigate)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15+ (App Router), TypeScript strict** | One codebase for UI + API routes + server components; easy deploy |
| DB | **PostgreSQL 16+** via **Drizzle ORM** | Relational fits players/datasets/shortlists; Drizzle = typed schema in code, migrations checked in |
| Raw file storage | **S3-compatible object storage** | Keep original uploads for reprocessing when parsers improve |
| Background work | **Postgres-backed job queue (pg-boss)** | Big imports must not run in the request cycle; no extra infra (no Redis) |
| Auth | **Auth.js** — email magic link + Google/Discord OAuth | FM community lives on Discord; zero password handling |
| UI | React + **hand-rolled Broadsheet CSS** (doc 09), pitch visuals as custom SVG | Chosen visual direction; no Tailwind/shadcn retrofit |
| Tables | **TanStack Table + TanStack Virtual** | Must handle 20k+ rows client-side with sort/filter |
| Validation | **Zod** on every API boundary | Uploads are untrusted |
| Tests | **Vitest** (unit: parser, engines), **Playwright** (E2E: upload→dashboard) | Docs 03/05/06 examples become fixtures |
| Deploy | Docker image; any container host + managed Postgres + S3 bucket | No vendor lock-in; Vercel works too if the import job is moved to a worker |

## Topology

```
Browser ── HTTPS ──> Next.js app (UI + API routes)
                        │
        ┌───────────────┼──────────────────┐
        ▼               ▼                  ▼
   PostgreSQL      Object storage     Worker process
 (parsed players,  (raw uploads,      (pg-boss consumer:
  datasets, users,  original HTML/CSV) parse + score imports)
  shortlists)
```

- **Web process**: serves UI, auth, CRUD APIs, dataset queries.
- **Worker process**: same codebase, separate entrypoint (`pnpm worker`). Consumes `import` jobs. Can be scaled independently; for small deployments it may run in-process behind a flag.

## Upload → analysis pipeline

1. **Client** requests a presigned upload (`POST /api/uploads`), sends the file directly to object storage. Limits enforced twice (presign policy + worker re-check): max **80 MB**, extensions `.html`, `.csv`.
2. **Client** confirms (`POST /api/datasets` with upload id, dataset name, save/season label) → creates a `dataset` row with status `queued` and enqueues an `import` job.
3. **Worker**:
   a. Streams the file from storage. Detects format (HTML table vs CSV — doc 03 §4).
   b. Parses rows via streaming parser (`htmlparser2` for HTML; `csv-parse` for CSV). Never loads a 50 MB DOM into memory.
   c. Normalizes each row into a `Player` (doc 04), collecting per-row problems into the **import report**.
   d. Runs the **Role Engine** (doc 05) and **Archetype Engine** (doc 06) per player; percentile passes run over the whole dataset after row ingest.
   e. Bulk-inserts players (`COPY`/batched inserts, 1k rows per batch), writes the import report, flips dataset status to `ready` (or `failed` with a reason a human can read).
4. **Client** polls `GET /api/datasets/:id` (status + progress %) and lands on the dataset dashboard when ready.

Target: 20k-row import fully scored in **< 60 s** on a 1 vCPU worker. Scoring is pure arithmetic; parsing dominates — hence streaming.

### Reprocessing

Engines will evolve (weights tuned, new archetypes). Every dataset stores `engine_version`. A maintenance job can re-run scoring (not parsing) for stale datasets from the stored normalized players; full re-parse from the raw file in storage is the fallback when the *parser* version bumps.

## Multi-tenancy & security

- Every `dataset`, `shortlist`, `snapshot` row carries `user_id`; every query is scoped by it at the data-access layer (single `withUser(userId)` repository wrapper — no ad-hoc queries in routes).
- **Share links**: a dataset can be published read-only at `/d/:publicSlug` (unguessable 12+ char slug). Sharing exposes players and computed scores, never the owner's identity, shortlists, or notes.
- Upload handling: files parsed with a streaming tokenizer, never executed/rendered; HTML is *data*, we extract text from `<td>` only. All parsed strings are treated as untrusted on render (React escaping; no `dangerouslySetInnerHTML` anywhere in dataset UI).
- Rate limits: 10 uploads/hour/user, 3 concurrent import jobs/user.
- Quotas (v1): 10 datasets/user, 200k player rows/user. Old datasets evict oldest-first with user confirmation.
- No FM/SI assets (logos, faces, kits) are stored or served — legal safety. Player identity is name + club + nation text from the user's own export.

## Project layout

```
/app                    Next.js routes (app router)
  /(marketing)          landing page
  /(app)                authed app: /datasets, /d/[slug], /players, /squad, /scout
  /api                  route handlers (thin: validate → call service)
/src
  /domain
    /attributes.ts      canonical attribute registry (doc 04)
    /roles/             role definitions + scoring (doc 05)
    /archetypes/        archetype definitions + scoring (doc 06)
    /squad/             squad analytics (doc 07)
  /import
    /detect.ts          format detection
    /parse-html.ts      streaming HTML table parser
    /parse-csv.ts       CSV parser
    /normalize.ts       header mapping, value coercion (doc 03)
  /db                   drizzle schema + repositories
  /jobs                 pg-boss handlers (import, rescore)
/tests
  /fixtures             real export files (small squad, big db, hostile cases)
/docs                   these documents
```

**Dependency rule:** `domain/` is pure TypeScript — no DB, no Next.js imports, 100% unit-testable. `import/` depends on `domain/`, `jobs/` on both. UI consumes only via repositories/API.

## Key decisions log

| Decision | Alternative rejected | Reason |
|---|---|---|
| Server-side parsing | Client-side (Web Worker) parsing | Datasets must persist across devices/sessions; server can reprocess when parsers improve; share links need canonical server data |
| Postgres for players | Keep players only as JSON blob | Filters/percentiles/upgrade-finder need indexed queries across 20k+ rows |
| pg-boss over Redis/BullMQ | | One less piece of infrastructure; Postgres is already there |
| Percentiles computed per-dataset at import | Global cross-user norms | Each save's game world differs; also avoids cross-tenant data mixing. Global benchmarks may come later as an explicit opt-in feature |
| No FIFA-style single "overall" | | Core product thesis (doc 01, principle 2) |
