# 15 — The Premium Overhaul (from prototype to flagship)

The plan that turns the current build (diagnosed in doc 14) into a product that feels
premium end-to-end. Phases are strictly sequential like doc 10's milestones; each ends
with **verifiable acceptance criteria**. Where this doc conflicts with docs 01–13, the
drift resolutions in doc 14 §4 win.

**The strategic call this plan makes:** perfect the **local-first product first**. The
engine is the asset; the hosted architecture (doc 02) is expensive, blocks nothing the
user feels today, and would freeze a UI that still needs restructuring. Hosting is P4 —
after the product deserves it. Until then the README must say what the product is.

---

## P0 — Stop the bleeding (hygiene, ~days)

No product change. Everything later depends on this.

Scope:

1. **`git init` + initial commit.** There is currently no version control at all.
2. **CI** (GitHub Actions once pushed, or a local `pnpm check` script until then):
   typecheck + vitest on every change. Add ESLint (flat config, TS + React hooks
   presets) and a `lint` script; fix or explicitly disable what it finds.
3. **Kill the dead layer.** Delete `src/domain/squad/analysis.ts` (greedy XI, legacy
   packages) and its test; move anything still referenced (none expected — verify) to
   the assistant layer. One `slotFit`/`ROLES_BY_SLOT` lives in `assistant/xi.ts`.
4. **One threshold source.** Anything numeric and tunable imports from
   `assistant/thresholds.ts` (`T`). No local `WEAK_FIT` copies.
5. **Apply the doc drift resolutions** (doc 14 §4, D1–D8): fix the 22/36 line in doc 06,
   the theme/stack lines in docs 02/10, formation set in doc 07, wage/contract
   annotations in 03/04, README stage honesty + full doc index with the 11→12→13
   supersession chain.

**AC:**
1. `git log` shows an initial commit; `.gitignore` respected (no `node_modules`, `data/*`).
2. `pnpm check` (typecheck + lint + test) passes and is the documented gate.
3. `rg "buildSquadPlan|WEAK_FIT" src` returns only `thresholds.ts`/assistant matches;
   test count does not drop except for the deleted legacy suite.
4. README describes a local-first product; every doc 14 §4 resolution is applied.

---

## P1 — The Broadsheet finish (make it *look and feel* premium, ~1–2 weeks)

The cheapest, most visible jump. Two workstreams: fix what's broken, then finish the
design system. All hard rules from doc 09 become enforceable here.

### A. Bug fixes (doc 14 §3.1, all seven)

1. "Try {formation}" re-runs the report (updates `committed`, not just the select).
2. `PackageCard` renders `rationale` (three sentences), `netSpend`, and funded-by sales.
3. `DirectorRead` uses the formation/budget the user last ran (persist assistant
   settings in the store; default 4-2-3-1/unlimited only when never run).
4. Ledger empty-filter state: "No players match. Loosen the filters." in desk voice.
5. Age column added to the ledger (sort key already exists); `toggleSort` dead branch fixed.
6. Upload race fixed (functional state update, not stale closure).
7. Home CTA becomes a real disabled `<button>` until a shortlist is loaded.

### B. Design-system completion (doc 09 made real)

1. **Ship fonts** via `next/font`: Source Serif 4 (display/body serif) + a grotesque
   sans (Inter acceptable per doc 09). Tabular numerals verified in the ledger.
2. **`InkBar` component with the five-step percentile ramp** (doc 09's hard rule:
   `#BDB6A6 → … → #B23B2E` top quintile). Replaces every ad-hoc bar (Dossier `Bar`,
   ledger bars, assistant zone/health bars). Number always shown next to the bar.
3. **Honesty marks everywhere:** masked = `?` at 50% opacity; ranged = italic hatched
   pill on the value. One `AttrValueCell` component; no local `–` fallbacks.
4. **Accessibility floor:** global `:focus-visible` (2px ink outline); radar
   `aria-label` speaks the top three axes as a sentence; ledger `j`/`k` row navigation
   and `s` shortlist-toggle; real `role="tab"`/`aria-selected` on segmented controls.
5. **Red scarcity restored:** `--green` removed from the palette sprawl (verdict/praise/
   zone bars restyled with ink density); attribute column headers lose the red underline.
   One red accent per view, as written.
6. **No bullet lists on product surfaces:** verdict reasons and callouts become prose
   sentences (the engine already writes sentences).
7. **Component kit extraction** (this is also the monolith teardown): `Masthead`,
   `Dateline` (live: save · N players · confidence), `InkBar`, `AttrValueCell`,
   `PullQuote`, `FactsRail`, `ArchetypeColumns`, `Footline`, `Stamp`, `SectionRule`
   under `components/kit/`. `Assistant.tsx` (718 L) splits into
   `assistant/{Controls,TeamReport,Pitch,Plans,PackageCard,SportingDirector,Findings}.tsx`;
   `Dossier.tsx` recomposes per `design/direction-a-broadsheet.html`: hero (name +
   standfirst | facts rail) → identity band (three archetype columns, not a table) →
   radar figure with caption | attribute columns + pull-quote → role table → footline.
8. **Sporting director UI debt (doc 13 §11):** health verdict word, age on sale rows,
   price-band detail, succession "show all" toggle; transfer insights merge into the
   Market tab.
9. `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` in Broadsheet voice.

**AC:**
1. All seven §A bugs have a regression test or a scripted manual check in the PR.
2. `rg "style=\{" components | wc -l` drops below 10 (dynamic widths only); no
   component file exceeds 300 lines.
3. A dossier screenshot side-by-side with `design/direction-a-broadsheet.html` matches
   its section order and identity-band structure.
4. Five-step ramp verified: a player at p55/p65/p75/p85/p95 renders five distinct bar
   colors with the number adjacent (unit-testable via class names).
5. Keyboard-only pass: upload → ledger (j/k/s) → dossier → assistant run, all reachable
   with visible focus.
6. Masked attribute renders `?`; ranged renders the hatched pill — asserted in a
   component test with a fixture player.

---

## P2 — The missing product (screens + engine wiring, ~2–4 weeks)

What makes it a *complete* scouting companion rather than a good pipeline with a viewer.

### A. Tactic truth (the deepest engine gap)

1. `src/domain/squad/tactic-presets.ts`: the four canonical formations (doc 14 §4 D5)
   with an **IP + OOP role pair per slot** and target DNA.
2. **`pairScore` becomes the fit currency** in `xi.ts`, `slots.ts`, packages, and the
   depth logic — `slotFit`'s best-single-role ceiling is retired. Doc 05 §4's stamina
   tax finally runs in production paths.
3. Position-group percentile cohorts in `buildScores` (doc 04): radar and dossier
   percentiles read against the player's group, whole-dataset kept for archetype gates
   per doc 06.

### B. The missing screens

1. **Front Page** at `/`: lead story + briefs + team-report box, computed from existing
   recommendations (the lead-picking logic already exists in `src/report/broadsheet.ts` —
   port it). Upload moves to `/upload` and to first-run empty states.
2. **Watch List** (`/watch`): a real product entity — named list of player refs with
   status (`watching / pursue / passed`) and a one-line note, persisted locally,
   surviving re-upload via the identity dedup key. "Add to watch list" from ledger
   (`s` key) and dossier footline.
3. **Compare** (`/compare?a=…&b=…`): two-to-four players, shared radar, attribute
   deltas with honesty marks, role-pair table. Entry from dossier footline and ledger.
4. **Ledger upgrades:** URL-synced filters (shareable), percentile ink bars in key
   columns.

### C. Scouting engines (doc 08, as domain modules first)

1. `src/domain/scouting/upgrade-finder.ts`: budget-capped, +5 threshold, per tactic
   slot using `pairScore` (doc 08 §3).
2. `src/domain/scouting/similar.ts`: cosine similarity on the archetype vector
   (doc 08 §4). "Find similar" from the dossier footline.
3. `src/domain/scouting/fit.ts`: "where he fits your side" — best slot, displaced
   player, partnership reads (doc 08 §9). Replaces the thin `DirectorRead` and feeds
   a proper dossier section.

**AC:**
1. Doc 05 §6 pair worked example passes *through the product path* (an XI built for a
   preset uses pair scores — integration test).
2. E2E-style flow (Playwright, added here): upload samples → Front Page shows a lead →
   ledger filter → dossier → add to watch list → compare two players. Green in CI.
3. Filter URL round-trip: pasting a ledger URL into a fresh session reproduces the
   result set.
4. Upgrade finder respects budget and +5 threshold (unit, per doc 10 M5 AC3).
5. Watch list survives a re-upload of the same save (unit on identity key + E2E).

---

## P3 — Engine hardening (trust at scale, ~2 weeks)

Premium software doesn't just look finished — it doesn't fall over on a 50 MB export.

1. **Import contract (doc 03 finished):** `/tests/fixtures/` corpus (six fixtures incl.
   `hostile.html`, `not-an-export.html`) with committed snapshots; typed rejects
   (`UNRECOGNIZED_FORMAT`, `INSUFFICIENT_COLUMNS`); `cellIssues` + `BAD_ATTRIBUTE_VALUE`
   reporting; Win-1252 fallback; HTML parser gets real tests. Split `parse.ts` per the
   doc 02 module layout while touching it.
2. **Off the main thread:** parse + `buildScores` move to a Web Worker; the UI shows a
   Broadsheet-voiced progress state. A 20k-row export must not freeze the tab.
3. **IndexedDB replaces localStorage** (quota kills large exports today). Same store
   seam; migration reads the old key once. Named datasets become possible (multiple
   saves), which the Watch List identity keys already anticipate.
4. **Calibration:** `engineVersion` constant surfaced in the dateline and import report;
   golden-players fixture (~40 real rows — needs the project owner, flag early per
   doc 10 M2) with ordinal assertions; doc 06 §7 property tests on a large fixture.
5. **Branded types:** `AttributeId`/`DerivedId`/`RoleId`/`ArchetypeId` unions replace
   bare strings in registries and scoring contexts; a registry-integrity test asserts
   every gate/weight metric is a valid id.

**AC:**
1. All six doc 03 §9 fixtures parse to committed snapshots; `hostile.html` produces the
   specified report; `not-an-export.html` rejects with a human-readable UI error.
2. `samples/real/fm26_biglist` imports with the tab responsive (no long task > 200 ms
   on the main thread during parse — measured once, documented in the PR).
3. Golden ordinal assertions and doc 06 §7 property tests green in CI.
4. `rowsTotal == rowsImported + rowsSkipped` and "no silent nulls" (every bad cell in
   `cellIssues`) enforced as invariants in tests.

---

## P4 — Hosted (the doc 02 promise)

Infrastructure is pinned in **doc 16**: Neon Postgres, Auth.js (password + Google), Vercel,
and a deliberately smaller v1 than doc 02's full topology (client-side worker parsing
stays; S3/pg-boss defer until share links demand canonical raw files).

**Status (July 2026):** code complete — store seam, persistence E2E, password reset, and
Vercel project `tfp-fm` are landed. Production deploy is ops: env vars on Vercel (doc 16
§6–8), `pnpm db:migrate` on Neon main, smoke test.

---

## Sequencing rationale

- P0 first because unversioned code and doc drift corrupt everything downstream.
- P1 before P2 because the component kit built in P1 is what P2's new screens are made
  of — building Front Page/Watch List/Compare out of ad-hoc JSX would double the work.
- P2 before P3 because tactic truth (`pairScore`) changes scores users see; better to
  land it before calibration fixtures freeze expectations.
- P4 last because hosting a product mid-restructure multiplies every change by
  client + server + migration.

## Standing risks

| Risk | Mitigation |
|---|---|
| `pairScore` switch shifts every fit number users have seen | Land with golden fixtures in the same phase-window; call it out in the dateline (`engineVersion`) |
| Font licensing (doc 09 names commercial faces) | Source Serif 4 + Inter are OFL — ship those; revisit only if the almanac character demands more |
| IndexedDB migration eats a user's dataset | Migration reads old key, writes new store, deletes old key only after verified read-back |
| Scope creep toward P4 | Hard rule: no server code before P3 AC sign-off |
