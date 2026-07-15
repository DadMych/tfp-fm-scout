# 10 — Roadmap

Milestones are strictly sequential; each ends with **verifiable acceptance criteria** (AC). Do not start milestone N+1 while N's ACs fail. Every AC maps to an automated test where feasible (unit/E2E), otherwise a scripted manual check documented in the PR.

## M0 — Skeleton & pipelines (foundation, no product value yet)

Scope: repo scaffold per doc 02 layout; Next.js app + worker entrypoint; Postgres schema migrations (doc 04 §5); auth (magic link + one OAuth); presigned upload flow; pg-boss wiring; CI running typecheck, lint, Vitest, Playwright smoke.

**AC:**
1. `docker compose up` boots web + worker + Postgres + MinIO locally; `pnpm test` green in CI.
2. A logged-in user can upload a file; a stub import job flips dataset status `queued → ready`.
3. Tenancy test: user B's API requests for user A's dataset return 404 (automated).

## M1 — Import engine (the moat's foundation)

Scope: full doc 03 — format detection, streaming HTML + CSV parsers, header synonyms, value coercion, position grammar, dedup, import report. All six fixtures committed with snapshot outputs.

**AC:**
1. All doc 03 §9 fixtures parse to their committed snapshots (unit).
2. 20k-row fixture imports end-to-end in < 60 s on 1 vCPU (measured in CI perf job, threshold 90 s to absorb CI noise).
3. `hostile.html` imports with correct report entries; `not-an-export.html` rejects with `UNRECOGNIZED_FORMAT` and human-readable UI error (E2E).
4. No row silently dropped: `rowsTotal == rowsImported + len(rowsSkipped)` invariant enforced in code and asserted in tests.

## M2 — Engines (roles + archetypes + derived)

Scope: docs 04 §4, 05, 06 in `src/domain/` (pure, no I/O). Registries complete. Percentile machinery. Golden fixtures file authored (this requires a human with FM26 access to source ~40 realistic player rows — flag to the project owner early).

**AC:**
1. Doc 04 §4, doc 05 §6, doc 06 §8 worked examples pass as unit tests.
2. Golden-fixture ordinal assertions pass (doc 05 §5, doc 06 §7).
3. Property tests from doc 06 §7 pass on the large fixture.
4. Full scoring of 20k players < 10 s (pure compute benchmark).
5. `engineVersion` bump + rescore job produces updated `player_scores` without re-parsing (integration test).

## M3 — Scout MVP (first shippable product)

Scope: dashboard (basic), scout table + filter system + URL state, player page (header, identity strip, radar, attribute grid, role matrix), compare view, shortlists (without series persistence), ⌘K search. Public share links. Onboarding screen with export tutorial + demo dataset.

**AC:**
1. E2E: upload squad fixture → dashboard → scout → filter `DM, deepProgressor ≥ 70` → player page → add to shortlist → shortlist shows entry.
2. Filter round-trip: copying the URL into a fresh session reproduces the result set (E2E).
3. Filter p95 < 500 ms on 20k dataset (perf job).
4. Share link renders player page logged-out, with no owner data leaked (E2E asserts absence of shortlist/notes DOM).
5. Demo dataset explorable without an account.

**→ Public beta after M3.**

## M4 — Squad analytics

Scope: doc 07 — tactic templates + presets, depth chart pitch view, age curve + insights, DNA fingerprint + target profiles, gap cards with Scout handoff, set-piece coverage.

**AC:**
1. Doc 07 §7 acceptance examples pass as integration tests.
2. Gap card "Scout for this" lands on Scout with the specified filters active (E2E).
3. Pitch view "copy as image" produces a PNG with watermark (E2E downloads and checks dimensions).

## M5 — Save series & time

Scope: SaveSeries, identity matching (doc 03 §7), shortlist persistence across re-uploads with snapshots/deltas, Development tab, upgrade finder + similar-player search (doc 08 §3–4).

**AC:**
1. Doc 08 §8 example 3 (shortlist survives re-upload with deltas) passes E2E.
2. Identity matcher: fixture pair (season N, N+1 with aging, transfers, one renamed regen) matches ≥ 95% correctly, zero false merges (unit with labeled fixture).
3. Upgrade finder respects budget caps and the +5 threshold (unit + E2E).

## M6 — Polish & growth loop

Scope: quotas/rate limits hardening, dataset eviction UX, saved filter presets, screenshot cards for players, read-only share polish, landing page, `/help/export` guide with the downloadable view file, analytics-free basic ops dashboards (import failure rate, p95s).

**AC:**
1. Load test: 20 concurrent 20k-row imports complete without failures; web p95 < 300 ms during the run.
2. Rate limits return friendly errors (E2E).
3. Lighthouse (desktop) ≥ 90 performance/accessibility on dashboard, scout, player page.

## Post-v1 candidates (do not build early)

- Match/performance stats ingestion (xG, ratings) — new export views + parser work.
- Global cross-user benchmarks (opt-in aggregated norms per division).
- Mobile layouts (Broadsheet light theme is v1 — doc 09).
- Public archetype leaderboards per shared dataset.
- FM24 export back-compat (if user demand shows up).

## Standing risks & mitigations

| Risk | Mitigation |
|---|---|
| Export plugin breaks on FM26 patches (it reads the game UI) | We consume files, not the game: parser tolerant to column changes (synonyms + unmapped-column reporting); keep fixture corpus growing from real failed uploads (with user consent checkbox on the error screen) |
| SI role changes invalidate registry | Roles/archetypes are data (registries + engineVersion + rescore); no code changes needed for weight updates |
| Community weight skepticism | Explainability popovers + published methodology page; golden fixtures keep us honest |
| Big uploads DoS the worker | Size caps, streaming, per-user concurrency limits, worker isolation |
