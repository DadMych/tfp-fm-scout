# 16 — Engine Truth & Platform (make it premium underneath)

The plan for everything below the pixels: the two semantic holes in the engine
(tactic truth, scouting tools), the import contract, the quality infrastructure the
project embarrassingly lacks, and the staged path from localStorage to the hosted
product of doc 02. Read with: doc 14 (audit), docs 03–08 (the specs being finished),
doc 15 (the UI plan that consumes several sections here).

Ground rules inherited from doc 11 §0: everything in `src/domain` stays pure,
deterministic and unit-tested; docs win over code; no invented data.

---

## §1. Tactic truth — pairScore everywhere (the biggest correctness gap)

**Problem (doc 14 §4.3):** the product's entire squad/assistant analytics run on
`slotFit` — the best single-role ceiling at a position (`assistant/xi.ts:43–50`) —
while docs 05/07/08 define fit as `pairScore(IP, OOP)` for a specific tactic slot.
The IP/OOP system is our stated reason to exist (doc 01); today it decorates the
Dossier role table and nothing else.

### 1.1 Tactic presets

New `src/domain/squad/tactic-presets.ts` (doc 07 §1): each preset = formation shape +
per-slot `{ ipRoleId, oopRoleId }` + target DNA. Ship the doc 07 set: 4-2-3-1 gegen,
4-3-3 possession, 4-3-3 pressing, 4-4-2 direct, 3-5-2 wing-back, 3-4-3, 5-3-2 low
block. `FormationId` becomes a union type; `TACTIC_DNA` keys off it (kills the
`Record<string, …>` hole).

### 1.2 slotFit → pairFit migration

- `slotFit(scores, slot)` gains a sibling `pairFit(scores, slot, preset)` =
  `pairScore` of the slot's IP+OOP pair (with the stamina tax, `roles/score.ts:64–78`).
- The XI solver, slot needs, zone strength, packages, sales board and every rule that
  reads fit switch to `pairFit` when a preset is active. `slotFit` remains as the
  "ceiling" fallback when the user has only picked a bare shape.
- All doc 11/12/13 tests re-baselined; the worked examples in doc 05 §6 for pairs
  become tests on the product path, not just the unit.

### 1.3 Depth semantics

Depth chart ranking per slot = `pairFit`, annotated `isNaturalPosition` (doc 07 §2).
The Assistant's need classification (hole/weak/thin) keeps its thresholds but reads
pair numbers.

**Acceptance §1:**
1. A player who is elite in the IP role but poor in the slot's OOP role ranks visibly
   lower than under old slotFit (fixture test with a constructed player).
2. Switching preset (same shape, different role pairs) changes the XI on the reference
   squad fixture (test asserts at least one changed starter).
3. Full suite green after re-baseline; no rule imports `slotFit` directly except the
   fallback path (`rg` check in CI).

## §2. The scouting engines (doc 08 becomes real)

Four pure modules, each consumed by doc 15 surfaces:

### 2.1 `src/domain/scout/upgrade.ts` — Upgrade Finder (doc 08 §3)

`findUpgrades(mine, slotCtx, pool, caps)`: candidates with
`pairScore ≥ mine + 5`, ranked by `delta × affordabilityFactor`; result carries the
3 biggest attribute advantages and the 1 biggest downgrade. Replaces the
`recommend()` margin heuristic as the product's upgrade path (recommend stays as the
Ledger verdict engine).

### 2.2 `src/domain/scout/similar.ts` — Similar players (doc 08 §4)

Vector = derived-metric percentiles + top-10 weighted attributes of the player's top
archetype; cosine similarity, same position group by default, top-20 with
similarity %. Brute force with typed arrays (spec says < 100 ms at 200k; our client
datasets are far smaller).

### 2.3 `src/domain/scout/compare.ts` — Compare data (doc 08 §5)

Pure assembly: per-player radar vectors, per-attribute best-value flags honoring
ranged/masked, archetype badge rows, role-pair scores for a chosen slot context.

### 2.4 `src/domain/squad/fit.ts` — "Where he fits your side" (doc 08 §9)

`fitToSquad(candidate, referenceSquad, preset)`: best slot by pairScore, verdict
(Upgrade / Rotation / Project / Not for you) with the doc 08 §9.1 bands, "what he
improves" brief assembled deterministically (slot delta, gaps closed, partnership
preview via `evaluateLinks`). One function serving the Dossier section, the fit
drawer and the Front Page briefs.

Also here: **filter predicates** move out of `ScoutDesk.tsx` into
`src/domain/scout/filters.ts` (composable, serializable — the same objects that back
the doc 15 URL state and the assistant's `scout` actions, which today carry a filter
shape too poor for handoff).

**Acceptance §2:**
1. Doc 08 worked behaviours as unit tests: upgrade respects the +5 threshold and
   budget caps; similar returns the stylistic twin above an unrelated same-position
   player on a constructed fixture; fit verdict bands hit their boundaries exactly.
2. Assistant gap insights' "scout for this" actions produce filter objects the Ledger
   can apply losslessly (round-trip test).
3. All four modules are pure (no imports outside `src/domain`) — enforced by an
   ESLint boundary rule (§4).

## §3. Import contract (doc 03, minus the server)

Everything here runs identically client-side today and in the §5 worker later.

1. **Typed failures.** `parseExport` returns
   `{ ok: true, … } | { ok: false, error: UNRECOGNIZED_FORMAT | INSUFFICIENT_COLUMNS }`;
   per-row `MALFORMED_ROW` (pad/truncate ±2) and per-cell `BAD_ATTRIBUTE_VALUE`
   entries land in the import report instead of silent nulls. The Uploader shows the
   human-readable reason (doc 10 M1 AC3).
2. **New columns, wired end-to-end:** wage, contract expiry, division, personality,
   preferred foot, "Not for Sale" — parser → `Player` → FactsRail → filters → the
   doc 13 §15 contract rules that are currently gated off. Update
   `tools/fm26_export/views` presets to emit them and re-export the samples.
3. **Robustness:** Win-1252/UTF-8 detection, `6'0"` heights, currency symbol tracking
   with a mixed-currency report warning, RU header synonyms (our own screenshots are
   RU-locale). Extract the synonym table to `src/import/header-synonyms.ts`.
4. **Fixture corpus** `tests/fixtures/`: the doc 03 §9 set — small squad, big list,
   `hostile.html`, `not-an-export.html`, masked-heavy search view — with committed
   snapshot outputs. The M1 "no silent drops" invariant asserted across all of them.
5. **Scale honestly.** Keep in-memory parsing (fine at squad/shortlist sizes) but move
   parse + score off the main thread into a **Web Worker** so a 20k-row list doesn't
   freeze the tab; a quiet "setting the page…" line per doc 09, no shimmer.

**Acceptance §3:**
1. All fixtures parse to committed snapshots in CI; `not-an-export.html` rejects with
   `UNRECOGNIZED_FORMAT` and the Uploader renders the message (DOM test).
2. A squad export with wage/expiry columns shows both on the Dossier FactsRail and
   enables one contract-risk insight (integration test).
3. 20k-row sample parses + scores without blocking the main thread (manual scripted
   check with CDP performance trace, documented in the PR).

## §4. Quality infrastructure (table stakes, week one)

Do these before or alongside everything above — they are the cheapest premium signal:

1. **`git init`** + initial commit + `main` branch protection habits. The project has
   never been committed; every plan in docs 15/16 needs history and revertability.
2. **ESLint** (flat config: typescript-eslint strict + react-hooks + an
   `import/no-restricted-paths` boundary rule keeping `src/domain` pure) and
   **Prettier**. `pnpm lint` script.
3. **CI** (GitHub Actions): typecheck + lint + vitest + build on every push; a perf
   job asserting full scoring of the 20k fixture < 10 s (doc 10 M2 AC4).
4. **Playwright smoke**: upload sample → Front Page lead → Ledger filter → Dossier →
   add to watch list. One test, the whole spine.
5. **Typed ids.** `MetricId = AttributeId | DerivedId`, branded `RoleId`/`ArchetypeId`,
   `FormationId` union; registries validated by a test that every gate/weight metric
   `isValidMetric` (the check exists and is never called today).
6. **Kill the legacy.** `src/domain/squad/analysis.ts` (greedy XI, duplicate
   thresholds, duplicate slotFit/packages — not on any product path) is deleted; its
   still-useful tests move onto the assistant equivalents. Thresholds unify under `T`.
7. **engineVersion.** A constant bumped on any registry/weight change; stored with
   every persisted dataset; on load mismatch, scores silently recompute (they already
   recompute every load — this just makes the contract explicit for §5 caching).

**Acceptance §4:**
1. CI green on a PR that touches domain, UI and import code.
2. `pnpm lint` fails on a test import from `src/domain` into `components/` (boundary
   proof).
3. Registry validation test fails when a bogus metric is added to a role (mutation
   check done once manually).

## §5. Persistence & platform (staged, no big-bang rewrite)

Doc 02's hosted architecture stays the destination; we refuse to pretend we're there
(doc 14 §5). Three stages, each shippable:

### Stage 1 — IndexedDB now (client, this quarter)

localStorage's ~5 MB cap is a hard blocker for full-database exports and the doc 15
Watch List. Replace the storage layer inside `lib/store.tsx` (the seam is already
clean) with IndexedDB (`idb`), keeping the same `DatasetProvider` API:

- Named datasets (more than one squad/shortlist), metadata (label, source, size,
  importedAt, engineVersion), eviction UI.
- Watch list entries and app settings (formation, budget) in their own stores.
- One-time migration from `tfp.datasets.v1`.

### Stage 2 — M0 for one user (the honest backend skeleton)

When we go hosted, do doc 10 M0 *as specced*: Docker compose (web + worker + Postgres
+ MinIO), Auth.js, presigned uploads, pg-boss, tenancy test. The doc 04 §5 schema
lands here. `DatasetProvider` swaps its storage adapter from IndexedDB to the API —
nothing above the store changes if Stage 1 kept the seam clean.

### Stage 3 — The multi-user product

Share links (`/d/:slug`), SaveSeries + identity matching (doc 03 §7) so watch lists
survive re-uploads with deltas (doc 10 M5), quotas/rate limits, the M6 polish loop.

**Acceptance §5 (Stage 1 only — later stages carry doc 10's own ACs):**
1. A 20k-row dataset persists and reloads from IndexedDB with scores recomputed
   in < 10 s (scripted check).
2. Two named shortlists coexist; deleting one leaves the other intact (unit test on
   the storage adapter).
3. Existing users' localStorage data migrates on first load (test with seeded key).

---

## §6. Sequencing (replaces doc 10's fiction with the real order)

Workstreams can run in parallel where the dependency column allows; within a
workstream, order is binding.

| # | Work | Doc | Effort | Depends on |
|---|---|---|---|---|
| 1 | git + lint + CI + typed ids + legacy deletion | 16 §4 | S | — |
| 2 | Fonts/ramp/honesty/focus + assistant debt + shell hygiene | 15 A, F, G | S–M | 1 |
| 3 | Component kit + Dossier recomposition | 15 B, C | M | 2 |
| 4 | pairScore + tactic presets | 16 §1 | M | 1 |
| 5 | Front Page + Ledger (URL state) | 15 D | M | 3 |
| 6 | Scouting engines (upgrade/similar/compare/fit) | 16 §2 | M | 4 |
| 7 | Watch List + Compare surfaces | 15 E | M | 5, 6 (compare data) |
| 8 | Import contract + Web Worker | 16 §3 | M | 1 |
| 9 | IndexedDB (Stage 1) | 16 §5 | S–M | 1 |
| 10 | Hosted M0+ (Stages 2–3) | 16 §5 | L | everything above worth hosting |

The premium bar, restated: after items 1–9, a user with one CSV gets — in one
browser, no account — a shipped-font Broadsheet product with a Front Page lead story,
a keyboard-driven Ledger with shareable filter URLs, a Dossier matching the reference
mock with explainable archetypes, tactic-true squad analytics, an upgrade finder and
similar-player search, a persistent Watch List with deltas, and an import pipeline
that never lies about what it read. That is "реально пиздато"; the hosted platform
then scales it, rather than excusing it.
