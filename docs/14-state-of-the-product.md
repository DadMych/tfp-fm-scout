# 14 — State of the Product (the honest audit)

Written from a full read of the codebase on 2026-07-15. This is the reference "what we
actually have" document: docs 15 and 16 are the plans that fix it. Where this doc and
older docs disagree about *what exists*, this doc wins; where they disagree about *what
should exist*, the spec docs win.

Baseline health at audit time: `pnpm typecheck` clean, `pnpm build` clean,
**145/145 unit tests green**. The problem is not that the code is broken — it is that
large parts of the promised product don't exist, and the parts that do stop short of
the bar the docs set.

---

## 0. Progress update (2026-07-15, after P0–P4 + docs 17–18)

Since the audit snapshot in §1–5 below: **git + `pnpm check`** (210 unit + E2E),
Broadsheet finish (doc 15 P1), engine truth and scouting tools (P2), import contract /
Web Worker / IndexedDB / calibration / branded types (P3), **hosted v1** (Neon,
Auth.js, store seam, persistence E2E), **doc 17 engine coherence** (verdict/fit
currency on preset pairFit, percentile cohort truth, SD chains/packages/rules — all
waves A–D), and **doc 18 visual identity** (unified `.control` spec, 36 archetype
engravings, family SVG icons, dossier art band, site furniture, OG/favicon) are
landed. Production deploy: **https://tfp-fm.vercel.app**. Front Page, Watch, Compare,
Similar, and Upgrades screens exist; §2–4 below still describe the original audit
baseline where noted.

---

## 1. The one-paragraph verdict

TFP FM today is a **strong single-user, client-only scouting prototype** with a genuinely
premium *brain* (archetypes, role engine, assistant, sporting director — pure, tested,
deterministic) wearing a **half-finished Broadsheet suit** and standing on **no
infrastructure at all** (no git repo, no lint, no CI, no backend, localStorage
persistence). The distance to "premium" is not one big rewrite; it is three focused
overhauls: finish the design system (doc 15), finish the product surfaces + engine truth
(doc 16 §1–3), and stand up the platform (doc 16 §4–5).

## 2. Maturity map

```
Domain engine (roles/archetypes)   █████████░  85–90% of spec, tested
Assistant + Sporting Director      █████████░  ~90% of docs 11–13
Import parser                      ████░░░░░░  MVP; not the doc 03 contract
Scout Ledger (/scout)              ██████░░░░  usable; no URL state, no density
Dossier (player page)              █████░░░░░  data complete, composition wrong vs mock
Assistant UI                       ████████░░  richest screen; rationale not rendered
Front Page (dashboard)             ░░░░░░░░░░  absent (home = upload form)
Watch List / Compare / Similar     ░░░░░░░░░░  absent
Design system (doc 09)             ███░░░░░░░  tokens yes; fonts/ramp/components no
Hosted architecture (doc 02)       ░░░░░░░░░░  absent; client-only
Quality infra (git/lint/CI/E2E)    █░░░░░░░░░  vitest only; no git repo
```

## 3. What is genuinely good (protect it)

1. **The pure domain layer.** `src/domain/` has no I/O, no framework imports, and covers
   attributes → derived → percentiles → roles → archetypes → dataset scoring →
   assistant → transfers. The worked examples from docs 04–06 exist as passing tests.
2. **The assistant catalog.** Nearly the full doc 11 rule set plus the doc 13 sporting
   director layer (sales board, ageing model, succession chains, packages v4) with the
   doc 12 dedup/priority fixes in place and tested.
3. **The honest-data culture.** Masked/ranged attribute handling flows through the whole
   engine; the "never silently drop a row" invariant is enforced in a test.
4. **The CLI twin.** `pnpm score` / `pnpm report` run the same engine offline —
   a real asset for debugging and content.
5. **The export tool.** `tools/fm26_export` (macOS BepInEx plugin fork + views) is more
   mature than the web backend and gives us the data pipe the whole product needs.

## 4. What is half-done (the premium gap, by area)

### 4.1 Design system vs doc 09 — the suit doesn't fit yet

| Doc 09 requirement | Reality | Where |
|---|---|---|
| Shipped licensed serif + sans (`next/font`) | System fallback only (Iowan/Palatino → Georgia; Helvetica → Arial) | `app/globals.css:5–6`, `app/layout.tsx` |
| 5-step percentile ink ramp (`#BDB6A6…#B23B2E`) | Binary 2-step `.pctbar`/`.hi` | `app/globals.css:67–72`, `components/Dossier.tsx:49–57` |
| Masked values render as `?` at 50% | Render as `–` (en-dash) | `components/Dossier.tsx:43–46` |
| Focus-visible 2px ink outline | No `:focus` rules at all | `app/globals.css` |
| PullQuote component (serif italic, red border) | Plain callout text | `components/Dossier.tsx:157–162, 211` |
| RadarFigure with figcaption | Radar without `<figure>`/caption | `components/Dossier.tsx:266–270` |
| ArchetypeColumns identity band | Replaced by a top-4 table | `components/Dossier.tsx:266–299` vs `design/direction-a-broadsheet.html:134–159` |
| Footline actions (shortlist/compare/similar/upgrades) | Source line + back link only | `components/Dossier.tsx:350–353` |
| Component inventory (Headline, FactsRail, InkBar…) | Inlined per-screen, no `components/ui/` kit | all of `components/` |
| Red is scarce | Zone/health bars spray red/green via inline styles | `components/Assistant.tsx:241–250, 548–558` |

### 4.2 Screens vs doc 09 — two of five exist properly

- **The Front Page** — absent. `app/page.tsx` is an upload form. The lead-story picking
  logic already exists in `src/report/broadsheet.ts` but is only used by the static CLI
  report, not the React UI.
- **The Ledger** (`/scout`) — works, but: no URL-synced filter state (roadmap M3 AC),
  no percentile ink bars in columns, no `j/k`+`s` keyboard, no empty state after
  filtering to zero rows (`components/ScoutDesk.tsx:243–274`), a Sort-by-age key exists
  with no Age column (`ScoutDesk.tsx:14, 83–84`).
- **The Dossier** — all the data, wrong composition vs the reference mock; wage/contract
  absent (parser doesn't extract them); "Where he fits your side" is a single hardcoded
  callout (4-2-3-1, infinite budget — `components/Dossier.tsx:124–130`), not the doc 08 §9 section.
- **The Assistant** — the best screen (doc 12 order, praise strip, spend meters all in),
  but: package `rationale` (3 sentences, spec'd in doc 12 §4.7) is computed and **never
  rendered** (`components/Assistant.tsx:454–526`); "Try formation" mutates the dropdown
  without re-running the report (`Assistant.tsx:429–434`); the Sporting Director block
  sits between plans and findings, which doc 12 §5.1 did not order; 718-line monolith.
- **The Watch List** — absent entirely. The word "shortlist" today means "the second
  uploaded dataset", not the doc 08 §6 curation tool (notes, status, deltas, named lists).

### 4.3 Engine vs specs — the two semantic holes

1. **Tactic truth.** Docs 05/07/08 build everything on `pairScore(IP, OOP)` per tactic
   slot. The shipped analytics (XI solver, depth, upgrade hints) run on `slotFit` =
   best-role ceiling at a position (`src/domain/assistant/xi.ts:43–50`). `pairScore`
   exists (`src/domain/roles/score.ts:64–78`) and is only exercised by a unit test.
   There are no tactic presets with IP/OOP pairs (`src/domain/squad/formations.ts` has
   4 bare shapes; doc 07 §1 specifies presets + target DNA).
2. **Scouting tools.** Doc 08 is ~15% real: no upgrade finder, no similar-player cosine
   search, no compare API, no shortlist persistence model, no `fit.ts` (fit to reference
   squad), no role-pair matrix. `recommend()` is a soft cousin, not the spec.

Secondary engine debt: percentiles are outfield/GK only, not position-group cohorts
(doc 04); archetype registry lacks position families and the Recovery Sprinter cohort
gate (doc 06); no golden-player fixtures or property tests (M2 AC); legacy
`src/domain/squad/analysis.ts` duplicates `slotFit`, thresholds and packages logic and
is not on the product path — drift risk.

### 4.4 Import vs doc 03 — practical, not production

Works on the real samples in `samples/`. Missing from the contract: encoding detection
(Win-1252), typed reject errors (`UNRECOGNIZED_FORMAT`, `INSUFFICIENT_COLUMNS`,
`MALFORMED_ROW`, `BAD_ATTRIBUTE_VALUE` in the report), wage/expires/division/personality
columns, currency tracking, `6'0"` heights, streaming for 50 MB files, the doc 03 §9
fixture corpus, SaveSeries identity matching. The file admits this itself
(`src/import/parse.ts:1–7`).

### 4.5 Platform vs doc 02 — nothing exists

No auth, no API routes, no Postgres/Drizzle, no object storage, no worker/pg-boss, no
Docker, no share links, no rate limits. Everything runs in the browser;
persistence is one localStorage key (`tfp.datasets.v1`, `lib/store.tsx:51`) — which
also caps datasets at ~5 MB, a hard blocker for full-database exports. The store
comments call itself the seam a real backend will replace; that is accurate and the
right seam to keep.

### 4.6 Quality infrastructure — the embarrassing list

- **No git repository.** The project has never been committed.
- No ESLint, no Prettier, no `lint` script, no CI, no Playwright/E2E, no perf jobs.
- No `app/error.tsx`, `not-found.tsx`, or `loading.tsx` routes.
- Accessibility: no focus styles anywhere, radar `aria-label` is generic
  (`components/Radar.tsx:68–69`), `role="tablist"` without `role="tab"`/keyboard
  (`components/ScoutDesk.tsx:132–138`), colour used alone on zone bars.

## 5. Roadmap reconciliation (doc 10)

The roadmap's "strictly sequential" rule was not followed. Actual status: **M0 not
started** (no auth/DB/CI/docker), M1 partial (parser MVP, no fixtures/streaming),
M2 substantially done on the domain side (minus golden fixtures/perf), M3 partial
(no URL state, share links, ⌘K, compare), M4 partial (via Assistant, not the doc 07
UI), M5/M6 not started. Meanwhile docs 11–13 (assistant, SD) were built as a parallel
track and are the most finished thing in the product.

That inversion was arguably the right call — the brain is the moat — but the premium
plan must now be explicit about sequencing instead of pretending doc 10 still describes
reality. The revised sequencing lives in doc 16 §6.

## 6. How the fix is organized

| Doc | Covers | Outcome |
|---|---|---|
| **15 — Broadsheet Finish** | Fonts, ramp, honesty marks, component kit, Dossier recomposition, Front Page, Ledger density, Assistant UI debt, Watch List & Compare shells, a11y | The product *looks and reads* premium on the data we already have |
| **16 — Engine Truth & Platform** | pairScore + tactic presets, scouting engines (upgrade/similar/compare/fit), import contract, quality infra (git/lint/CI/E2E), persistence (IndexedDB now, hosted M0 after) | The product *is* premium underneath, and can grow into the hosted vision |

Rule of thumb for every task in both docs: **it ships with an acceptance check**, in the
tradition of docs 10 and 12. Nothing "polished" without a way to verify it.
