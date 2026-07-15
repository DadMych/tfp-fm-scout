# 15 — Broadsheet Finish (make the suit fit)

The plan that takes the UI from "recognisably Broadsheet" to **the product doc 09
describes**, using only data the engine already computes. No backend required for any
task in this doc. Read with: doc 14 (audit — the "why"), doc 09 (the law), doc 12
(assistant UX — still binding), `design/direction-a-broadsheet.html` (the reference).

Every phase ends with acceptance checks. Phases are ordered by
(user-visible impact ÷ effort); each is independently shippable.

---

## Phase A — The cheap visual leap (fonts, ramp, honesty, focus)

Four fixes that together move every screen at once.

### A1. Ship the fonts

- Add `next/font` with **Source Serif 4** (display + editorial, incl. italic) and
  **Inter** (labels/data/chrome) in `app/layout.tsx`; expose as CSS variables
  (`--font-serif`, `--font-sans`) consumed by `globals.css`. Keep the doc 09 fallback
  stacks behind them.
- `font-variant-numeric: tabular-nums` on every element that renders a figure — audit
  all tables, facts rails, spend meters, evidence pills.

### A2. The five-step InkBar

Replace the binary `.pctbar`/`.hi` with one reusable `InkBar` component
(`components/ui/InkBar.tsx`):

- Five discrete steps by percentile quintile: `#BDB6A6 / #948C7C / #6B6456 / #2C281F`,
  top quintile `#B23B2E` (doc 09 ramp). Crisp steps, no gradient.
- The number label always renders beside the bar; the component takes
  `{ percentile, label }` and nothing else.
- Adopt it everywhere a percentile is drawn: Dossier attribute rows, Radar axis
  summaries, Ledger columns (Phase D), Assistant zone bars.

### A3. Honesty marks

- `MaskedMark`: masked attribute renders `?` in `ink-3` at 50% opacity — replace the
  en-dash in `components/Dossier.tsx:43–46` and anywhere else a masked value appears.
- `RangedPill`: ranged values (`11–13`) in italic inside the 45° 6%-ink hatched pill.
  The hatch moves from the bar to the **value treatment** (doc 09 says the value itself
  must read as "not a firm number").
- Both are components in `components/ui/`, used by Dossier, Ledger and Assistant alike.

### A4. Focus & motion floor

- Global `:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }`.
- Transitions capped at 120–180 ms opacity/position; remove any easing that bounces.
- One permitted flourish: headline + pull-quote fade in once on Dossier load.

**Acceptance A:**
1. Screenshot of the Dossier on a machine without Iowan/Palatino shows Source Serif 4,
   not Georgia (check computed style in CDP).
2. `rg -n "pctbar|\.hi" app components` returns only the new InkBar internals.
3. A masked attribute renders `?`; a ranged one renders the hatched italic pill —
   verified in a vitest DOM test for each component.
4. Tabbing through the Ledger shows a visible 2px ink outline on every stop.

---

## Phase B — The component kit (stop inlining the design system)

Create `components/ui/` and extract the doc 09 inventory as real components. This is
refactoring, not redesign: screens keep their behaviour, markup moves.

| Component | Extracted from | Notes |
|---|---|---|
| `Masthead` | `AppHeader.tsx` | wordmark + nav caps; unchanged visually |
| `Dateline` | ad-hoc strips in `scout/page.tsx:8–11`, `assistant/page.tsx:8–11`, `Dossier.tsx:187–193` | one component: save · dataset (n players) · masked share · imported date. Rendered under the Masthead on **every** screen with a dataset loaded |
| `Headline` | Dossier hero | eyebrow (sans caps) + display serif + optional standfirst |
| `FactsRail` | Dossier facts | `<dl>`, 2px ink top rule, right-aligned tabular values |
| `SummaryLine` | Dossier | serif italic, headline furniture |
| `InkBar`, `MaskedMark`, `RangedPill` | Phase A | |
| `PullQuote` | new | serif italic 24–28px, 3px red left border, max one per page |
| `RadarFigure` | `Radar.tsx` | wrap in `<figure>` + `<figcaption>`; aria-label becomes a sentence naming the top three axes (doc 09 a11y) |
| `Stamp` | CSS class → component | Elite gold / Strong ink / Critical red small caps |
| `Footline` | new | sans action row + "Analysed with TFP FM" mark |
| `EmptyState` | copy-pasted blocks in ScoutDesk/Dossier/Assistant | one component: message + red link |

Rules:
- No component takes a `style` prop. Dynamic widths (bars, meters) are the only inline
  styles allowed, and only inside `ui/` internals.
- Kill the duplicated helpers: `surname()` local to `Assistant.tsx` → import from
  `phrases`; `VERDICT_LABEL` duplicated in Assistant/Dossier → one module.
- `globals.css` splits into `tokens.css` (palette, type scale, spacing) and
  `components.css`; screens stop defining one-off classes.

**Acceptance B:**
1. `rg -n "style=\{" components app --glob '!components/ui/*'` → only dynamic-width
   exceptions, each with a `/* dynamic */` comment; target ≤ 6 total (was ~32).
2. Every screen renders the shared `Dateline` when a dataset is loaded (E2E-lite: vitest
   + testing-library render of each page component).
3. No visual regression on Assistant (doc 12 acceptance checklist §8 still passes by
   manual smoke).

---

## Phase C — The Dossier, recomposed (the reference mock, for real)

Rebuild `components/Dossier.tsx` (413 lines, monolith) to the mock's structure
(`design/direction-a-broadsheet.html`), splitting into section components:

1. **Hero** — `Headline` (eyebrow = general archetype) + `SummaryLine` + standfirst,
   with the `FactsRail` in the 300px right rail (1fr/300px grid per doc 09).
2. **Identity band** — replace the top-4 table (`Dossier.tsx:266–299`) with
   `ArchetypeColumns`: primary / secondary / also, vertical hairlines, rank label,
   large score (primary red), serif name, gold Elite/Strong stamp, one-line italic
   description. Clicking a column opens the **contribution breakdown** — which needs a
   small engine addition: export per-metric contribution points from
   `src/domain/archetypes/score.ts` (the data is computed and discarded today).
3. **Figure row** — `RadarFigure` (300px) + attribute columns. Attributes move from the
   3-col grid to newspaper `column-count: 2` regions per group, sans group header with
   2px ink underline, hairline row rules.
4. **PullQuote** — promote the strongest percentile sentence (already computed at
   `Dossier.tsx:157–162`) into the real `PullQuote` component. Exactly one.
5. **Role tables** — keep, restyled to ruled tables; add the **RolePairGrid**
   (IP × OOP pairScore matrix) once doc 16 §1 lands — leave a named TODO section, do
   not fake it with slotFit.
6. **"Where he fits your side"** — replace the hardcoded `DirectorRead`
   (`Dossier.tsx:124–130`, frozen 4-2-3-1 + infinite budget) with the user's actual
   Assistant settings (formation + budget from a shared settings store). Full doc 08 §9
   treatment arrives with doc 16 §2; until then the section states its assumptions in
   the dateline ("assessed against your 4-2-3-1, €64M cap").
7. **Footline** — real actions: *Add to watch list* (Phase E), *Compare* (Phase E),
   *Find similar* / *Find upgrades* (disabled with title "arrives with the scouting
   engines" until doc 16 §2 — a disabled control with an honest label, not a missing
   feature).
8. Remove the `<ul>` bullet list from the verdict callout — reasons become prose
   sentences joined properly (doc 09 forbids bullets in the product surface).

**Acceptance C:**
1. Side-by-side screenshot: live Dossier section order matches the mock
   (hero → identity band → figure row → pull-quote → roles → fit → footline).
2. Clicking the primary archetype column opens a breakdown listing each contributing
   metric with points (unit test on the new engine export + DOM test on the popover).
3. Exactly one `PullQuote` per Dossier render (DOM test).
4. `Dossier.tsx` ≤ 150 lines; sections live in `components/dossier/`.

---

## Phase D — The Front Page and the Ledger density

### D1. The Front Page (`/`)

The home screen becomes the doc 09 Front Page; upload moves to a compact panel.

- **Lead story**: the most interesting player in the loaded set — reuse the
  lead-picking logic already shipped in `src/report/broadsheet.ts` (extract it to
  `src/domain/frontpage.ts` so the CLI and UI share one implementation). Headline,
  summary line, verdict stamp, link to Dossier.
- **Briefs column**: 4–6 one-line findings (youngest Elite, biggest bargain, best
  free agent…) — each links into the Ledger **with the filter applied** (needs D2 URL
  state).
- **Team Report box**: when a squad is loaded, the Assistant's three-paragraph team
  report (already computed) in a ruled box, linking to `/assistant`.
- **Empty state**: no dataset → the current upload hero remains, plus the sample-data
  link. `?demo=1` behaviour unchanged.

### D2. Ledger upgrades

- **URL-synced filters** (roadmap M3 AC): filter + sort state serializes to
  querystring; copying the URL reproduces the result set. Use `useSearchParams` +
  `router.replace`, debounced.
- **Empty-filter state**: zero rows → EmptyState with "clear filters" action
  (`ScoutDesk.tsx:243–274` today renders a bare `<tbody>`).
- **Age column** (the sort key exists at `ScoutDesk.tsx:14` with no column) + InkBar
  percentile columns for 2–3 key derived metrics.
- **Keyboard**: `j/k` moves row focus, `Enter` opens Dossier, `s` toggles watch list
  (doc 09 a11y). Proper `role="tab"`/`aria-selected` on the dataset tabs.
- **Back-preserving navigation**: Dossier "back to the ledger" returns to the filtered
  URL, not bare `/scout`.

**Acceptance D:**
1. E2E-lite: load sample → Front Page shows a lead story with a working Dossier link
   and ≥ 3 briefs that land on a pre-filtered Ledger.
2. Copying a filtered Ledger URL into a fresh tab reproduces the same row count.
3. Filtering to zero shows the EmptyState with a working reset.
4. `j`/`k`/`Enter`/`s` work with the table focused (DOM test with keyboard events).

---

## Phase E — Watch List & Compare (the missing surfaces)

### E1. Watch List (`/watchlist`)

The doc 08 §6 / doc 09 curation tool, client-side for now:

- Store: `tfp.watchlist.v1` in the dataset store — entries
  `{ playerId, datasetKind, addedAt, note, status: watching|bid-target|rejected,
  scoreSnapshot }`.
- UI: ruled list, serif names, margin note column (inline-editable), status in small
  caps, **deltas since added** (current top-archetype score vs snapshot) as small
  red/ink figures.
- "Add to watch list" lands in the Dossier Footline (Phase C) and the Ledger `s` key
  (Phase D).
- Export as CSV (name, club, age, value, top archetype, best role).
- Masthead nav becomes: **Front Page · Ledger · Watch List · Assistant** (+ Compare
  entry from selection contexts).

### E2. Compare (`/compare?ids=…`)

2–4 players side by side, all engine data already available:

- Radar overlay over the 8 derived metrics (percentile space).
- Attribute table with per-row best-value bolding; ranged/masked honesty marks apply.
- Archetype badge rows; role-pair rows arrive with doc 16 §1.
- Entry points: Ledger row checkboxes → "Compare (n)" in the guidance strip; Dossier
  Footline.

**Acceptance E:**
1. E2E-lite: add two players to the watch list from the Ledger, reload the page,
   entries persist with notes and status editable.
2. A watch-list entry shows a delta figure after its snapshot score is artificially
   lowered in the stored JSON (unit test on the delta computation).
3. `/compare?ids=a,b` renders both players' radars and a best-value-bolded attribute
   table; the URL is shareable within the session.

---

## Phase F — Assistant UI debt

Small list, big reading-experience payoff (doc 12 leftovers):

1. **Render `pk.rationale`** — the 3-sentence rationale is computed
   (`packages.ts`) and dropped by `PackageCard` (`Assistant.tsx:454–526`). It is the
   voice of the product; show it under the moves list.
2. **"Try formation" re-runs.** The action currently mutates the dropdown and silently
   does nothing (`Assistant.tsx:429–434`). Make it set state *and* re-run the report.
3. **Sporting Director placement.** Move the SD block (health/sales/succession,
   `Assistant.tsx:331–334, 529–647`) into a tabbed section alongside findings, so the
   doc 12 §5.1 order (plans → findings) is restored and the page stops being a scroll
   marathon.
4. **Split the monolith**: `components/assistant/` — `Controls`, `TeamReport`,
   `PitchXI`, `PlanCard`, `FindingsFeed`, `PraiseStrip`, `DirectorDesk`. Target:
   `Assistant.tsx` ≤ 120 lines of composition.
5. **Zone bars adopt the InkBar ramp** — red returns to being scarce; green stays only
   in the praise strip.

**Acceptance F:**
1. Every rendered package shows ≥ 3 sentences of rationale (DOM test, split on ". ").
2. Clicking "Try 4-3-3" produces a report whose header names 4-3-3 without further
   clicks (DOM test).
3. Plans render directly above the findings feed with no SD block between (DOM order
   assertion).

---

## Phase G — App-shell hygiene

- `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` in Broadsheet voice
  ("The presses have jammed." / "This page isn't in today's edition.").
- localStorage failure surfacing: corrupt store or quota-exceeded currently fail
  silently (`lib/store.tsx:71–73, 81–83`) — surface a quiet Dateline notice
  ("stored copy unavailable — this session only").
- Responsive pass at 900px and 1280px: the Ledger table gets `overflow-x` with a sticky
  name column; plans grid follows doc 12 (1-col < 1100px).
- Home CTA stops being an `aria-disabled` `<Link>` (`app/page.tsx:58–64`) — render a
  disabled button element when there is no dataset.

**Acceptance G:**
1. Throwing inside a page component shows the branded error page (dev-mode check).
2. Filling localStorage to quota then uploading still loads the dataset in-memory and
   shows the notice (manual scripted check documented in the PR).
3. Lighthouse accessibility ≥ 90 on Front Page, Ledger, Dossier (M6 target pulled
   forward for a11y only).

---

## Sequencing & effort

| Phase | Effort | Depends on |
|---|---|---|
| A fonts/ramp/honesty/focus | S | — |
| B component kit | M | A |
| C Dossier recomposition | M | B |
| D Front Page + Ledger | M | B (D1 also uses broadsheet.ts extraction) |
| E Watch List + Compare | M | B, D2 (keyboard + selection) |
| F Assistant debt | S–M | B |
| G shell hygiene | S | — (parallel) |

A + F + G alone are roughly a week of work and remove most of the "полуготовое"
feeling. B–E are the real product finish.
