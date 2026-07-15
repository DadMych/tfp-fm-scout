# 14 — State of the Product (July 2026 audit)

An honest, file-level audit of what exists versus what docs 01–13 promise. This document
is the *diagnosis*; doc 15 is the *treatment plan*. When prioritizing work, trust this
document over the README's marketing description.

Audit method: full read of `app/`, `components/`, `lib/`, `src/`, `scripts/`, `design/`,
plus `pnpm test` (145/145 green), `pnpm typecheck` (clean), `pnpm build` (clean).

---

## 0. Verdict in three sentences

The **brain is premium, the body is a prototype**. The pure domain engine (attributes,
roles, archetypes, assistant, sporting director) is substantially complete, well-tested
against the docs' worked examples, and is the real asset. The product around it is a
four-route client-only SPA with localStorage persistence, a half-applied Broadsheet
design, missing scouting tools, and zero infrastructure (no git repo, no CI, no backend).

## 1. What actually exists

### 1.1 Surfaces (React app)

| Route | File | Reality |
|---|---|---|
| `/` | `app/page.tsx` (71 L) | Upload landing + sample data CTA. **Not** the doc 09 Front Page. |
| `/scout` | `components/ScoutDesk.tsx` (277 L) | Ledger: shortlist/squad toggle, filters, sortable table. Usable. |
| `/scout/[kind]/[id]` | `components/Dossier.tsx` (413 L) | Dossier: verdict, radar, attributes, roles. Composition diverges from the reference mock. |
| `/assistant` | `components/Assistant.tsx` (718 L) | The most mature surface: XI, gaps, transfer plans, sporting director, findings. Implements most of doc 12. |

No `app/api/` routes. Data flow: file → client-side `parseExport` → `buildScores` →
React context → `localStorage` (`tfp.datasets.v1`). Scores recomputed on load.

### 1.2 Engine (`src/domain/`, `src/import/`, `src/report/`)

~8,000 lines of pure TypeScript, 18 test files, 145 tests, all worked examples from
docs 04/05/06 pass. CLI twins exist (`pnpm score`, `pnpm report`).

### 1.3 Export tooling

`tools/fm26_export/` — the macOS BepInEx export plugin. Separate product; only a data
pipe into the parser. More mature than the web backend (which does not exist).

## 2. Maturity scorecard (spec → code)

| Doc | Area | Completeness | Notes |
|---|---|---|---|
| 02 | Hosted architecture | **0%** | No Postgres/Drizzle/Auth.js/S3/pg-boss/API/Docker. Client-only SPA. |
| 03 | Import | **~40%** | Real FM26 CSVs parse fine. No streaming, no encoding fallback, no typed rejects (`UNRECOGNIZED_FORMAT`/`INSUFFICIENT_COLUMNS`), no `cellIssues`, no `/tests/fixtures/` corpus, no wage/expires/division columns. HTML path untested. |
| 04 | Data model | **~55%** | Registry, derived, percentiles complete. `Player` slimmed (no wage/contract/division/flags). Percentile cohorts are outfield/GK only — no position-group cohorts. No DB. |
| 05 | Role engine | **~70% math / ~30% product** | 86 IP/OOP roles, scoring formula + masking correct. **`pairScore` exists but is only called from its own test** — all product paths use `slotFit` (best single role). No tactic presets with IP+OOP pairs. No golden fixtures, no `engineVersion`. |
| 06 | Archetypes | **~85%** | 36 archetypes, gates, cap-40, general/hybrid, summary line — all tested. Missing: position-family gating, Recovery Sprinter cohort, archetype→role crosswalk, §7 property battery, contribution-breakdown API. |
| 07 | Squad analytics | **~50%** | Semantics shifted into the assistant layer (fine). Missing as specced: tactic presets, `pairScore` depth charts, age curve, `findGaps`, `reference.ts`, `fit.ts`, season deltas. Legacy `squad/analysis.ts` (greedy XI + own packages) is dead code kept alive by its test. |
| 08 | Scouting tools | **~15%** | No upgrade finder, no similar-player search, no compare, no persistent shortlists/watch list, no URL filter state, no fit-to-squad. `recommendation.ts` is the only scout-guide layer. |
| 09 | Broadsheet design | **~40%** | Tokens/palette/masthead yes. Missing: shipped fonts, 5-step percentile ramp (binary now), masked-`?` honesty, focus-visible, component kit, Front Page, Watch List, Compare, dossier composition per mock. The closest Broadsheet fidelity is the **CLI HTML** (`src/report/broadsheet.ts`), not the app. |
| 10 | Roadmap | **out of order** | M0 not started (no git!), M1/M2 partial, M3 partial, docs 11–13 built on top anyway. |
| 11 | Assistant engine | **~90%** | Nearly full rule catalog, Hungarian XI, packages, team report. Gaps: SHAPE-3, SLOT-6, phrase-engine-as-data, per-rule test matrix. |
| 12 | Assistant UX | **~80%** | Order/dedup/praise strip/collapse done. **`pk.rationale` is computed but never rendered.** Plans grid breakpoint wrong (900 vs 1100). |
| 13 | Sporting director | **~90% engine / ~60% UI** | Ageing/sales/chains/succession/health/board all present with tests. UI thin: no health verdict word, no price-band detail, no `netSpend`/sales under package moves, transfer insights in their own tab instead of Market. |

## 3. Defect catalog (the concrete raw spots)

### 3.1 Bugs and broken interactions

1. **"Try {formation}" doesn't re-run the search** — sets the dropdown only
   (`Assistant.tsx` ~429–434 vs `committed` state ~114–118). Silent no-op for the user.
2. **`pk.rationale` never rendered** — the engine writes three sentences per package;
   `PackageCard` (`Assistant.tsx` ~454–526) drops them. Same for `netSpend`/`sales`.
3. **Dossier `DirectorRead` hardcodes 4-2-3-1 and an infinite budget**
   (`Dossier.tsx` ~124–130) — ignores whatever the user actually ran on Assistant.
4. **Empty filter result is a blank `<tbody>`** — no "0 players match" state
   (`ScoutDesk.tsx` ~243–274).
5. **`SortKey` includes `"age"` but there is no Age column**; `toggleSort` has a dead
   branch (both arms set `"asc"`) (`ScoutDesk.tsx` ~14, ~83–84).
6. **Rapid sequential uploads can race** — `loadText` closes over stale `raw`
   (`lib/store.tsx`); last write wins with a stale merge.
7. **Home CTA is a `Link` with `aria-disabled`** — visually disabled, still focusable
   and navigable (`app/page.tsx` ~58–64).

### 3.2 Broadsheet violations (doc 09 hard rules broken)

- Percentile color is **binary** (`.hi` ≥ 80), not the mandated five-step ramp
  (`app/globals.css` ~67–72).
- Masked attributes render as `–`, not `?` at 50% opacity (`Dossier.tsx` ~43–46).
- No `:focus-visible` styles anywhere; no `j/k`/`s` ledger keys.
- No shipped serif/sans — system stacks only; on non-Apple machines the product is
  Georgia + Arial (`app/layout.tsx`, `globals.css` ~5–6).
- Bullet lists inside product surfaces (Dossier/Scout callouts) — explicitly forbidden.
- `--green` used as a broad accent (verdicts, praise, zone bars) — not in the palette;
  red is no longer scarce (attr headers, links).
- Radar `aria-label` is generic, not "top three values as a sentence".

### 3.3 Engine debt

- **`slotFit` + `ROLES_BY_SLOT` duplicated** in `squad/analysis.ts` and `assistant/xi.ts`.
- **Thresholds duplicated**: `analysis.ts` hardcodes `WEAK_FIT`/`THIN_*`/`AGE_RISK`
  instead of importing `assistant/thresholds.ts`.
- **Legacy `squad/analysis.ts`** (`buildSquadPlan`, greedy XI, own package builder) is
  unused by the product — only its test keeps it alive.
- Metric/role/formation ids are bare `string`s — no branded types, no runtime registry
  validation in `buildScores`.
- `coerceAttr` silently nulls bad cells (the comment even names `BAD_ATTRIBUTE_VALUE`)
  but never reports them; corrupt localStorage and quota overflows are swallowed.
- `formatMoney` hardcodes `€`; currency is not tracked through import.

### 3.4 Infrastructure

| Item | Status |
|---|---|
| Git repository | **Not initialized** (`.gitignore` exists, `.git` does not) |
| CI | None |
| ESLint / Prettier | None (no `lint` script) |
| E2E (Playwright) | None |
| Import fixtures (`/tests/fixtures/`) | None — doc 03 §9 corpus absent |
| Vitest + typecheck | Present and green |

## 4. Documentation drift registry

Resolutions here are **binding**; doc 15 schedules the edits.

| # | Drift | Resolution |
|---|---|---|
| D1 | README + docs 01/02 claim a hosted multi-user product; code is a local-first SPA | README gets an honest "current stage" section. Hosted remains the destination (doc 15 phase P4), not the description. |
| D2 | Doc 06 §9 says "22 fine archetypes"; §3 and the registry say 36 | **36 is canonical.** Fix §9. |
| D3 | Doc 02 says "dark-first + Tailwind + shadcn"; doc 09 chose light-first Broadsheet with hand-rolled CSS; doc 10 lists "light theme" as post-v1 | **Doc 09 wins.** Fix 02 and 10. The hand-rolled CSS approach is ratified — no Tailwind/shadcn retrofit. |
| D4 | Docs 03/04/07/08 parse and filter wage/contract; docs 11 §0 and 13 §0 say the assistant must not reference them | **11/13 win until the export view ships those columns.** Annotate 03/04 fields as "reserved — not in current export". |
| D5 | Formation presets disagree (07: 3-4-3, 5-3-2 vs 11/code: 3-5-2) | **Code + doc 11 set is canonical** (4-2-3-1, 4-3-3, 4-4-2, 3-5-2). Fix 07. |
| D6 | Two DNA models: fine-archetype counts (06/07) vs general-family counts with family-best fix (11/12) | **Doc 12 model is canonical.** Mark 07 §3 as superseded. |
| D7 | README doc index stops at 10; docs 11–13 amend each other silently | Index all docs; state the supersession chain 11 → 12 → 13 explicitly. |
| D8 | Import size story: 01 says ~50 MB, 02/03 say 80 MB | 80 MB is the limit; 50 MB is the perf target. Clarify 01. |

## 5. What is genuinely good (do not churn)

- The **domain purity discipline** held: `src/domain` has no Next/DB imports and every
  formula has a worked-example test. This is the seam that makes everything in doc 15
  possible.
- The assistant + sporting director stack (docs 11–13) is close to spec and is the
  product's real differentiator in code today.
- `lib/store.tsx` is a clean, well-commented seam for a future backend.
- The CLI (`pnpm score` / `pnpm report`) doubles as an offline harness for the engine.
- The export tooling and view presets are aligned with the parser's header synonyms.
