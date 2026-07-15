# 19 — Desk Clarity (Front Page overhaul, tactic advice, honest funding, package legibility, art-first dossier)

Fix plan from the 2026-07-15 product review (owner feedback with screenshots). Six
workstreams, ordered by user pain. Each ends with verifiable acceptance criteria.
Where this doc conflicts with docs 09/11/13, this doc wins — it corrects surfaces
those docs under-specified.

---

## 1. Front Page overhaul — kill the orphan bars

**The problem (screenshot).** Every brief card on `/` renders a lone ink bar:
`Heading ▬▬ 100`, `First Touch ▬▬ 100`, `Decisions ▬▬ 100`. Because
`standouts(s, 1)` picks the player's *top* percentile, the bar is almost always
full and the number is almost always 100 — a red stick that communicates nothing
and reads as a broken slider. The Front Page is the first screen a returning user
sees; it currently looks unfinished.

**Scope** (`components/FrontPage.tsx`, `src/domain/front-page.ts`, `app/globals.css`):

1. **Remove the bar row from brief cards.** A single always-full bar is noise. The
   standout becomes a prose clause appended to the headline sentence, in Broadsheet
   voice: "Elite anchor — but DM/CM is already covered; a luxury, not a need.
   *96th percentile for heading here.*" One sentence, no widget.
2. **Briefs earn their name.** Each card gets the facts a scout actually wants at a
   glance: age · position · value on a hairline sub-row (same pattern as the ledger
   `sub` row). The verdict stamp stays.
3. **Diversify the picks.** Four "Bargain" stamps in a row is a symptom: `briefs`
   sorts by `rec.rank` only. Take at most two per verdict tone so the column reads
   like a news column, not one repeated story.
4. **Lead story gets the engraving.** The lead player's top-archetype art
   (`ArchetypeArt`) joins the `fp-hero` — see §6 for sizing; Front Page uses the
   medium size. The hero currently has no image at all.
5. **Rhythm pass.** `valuepick` strip, `team-report`, `briefs`, CTA row — verify
   vertical rhythm against `design/direction-a-broadsheet.html` margins; the CTA
   row must not collide with the last brief's border.

**AC 1:**
1. No `InkBar` renders inside `.brief-card`; the standout appears as a prose clause
   (DOM test).
2. A dataset where the top four recommendations share one verdict still renders at
   least two distinct verdict stamps in the briefs (unit test on the pick logic).
3. Lead story renders the top-archetype engraving; screenshot matches the mock
   rhythm.

---

## 2. Watch list from everywhere

**The problem.** "Add to watch" exists only on the dossier footline and the ledger
`s` shortcut. From search results, Front Page briefs, similar/upgrades results, and
package moves there is no affordance at all — the user must open every dossier.

**Scope:**

1. **Ledger rows** (`components/ScoutDesk.tsx`): a watch toggle on each row (the
   row already computes `watched` and renders a passive `watch-mark`). Small
   `☆/★`-style control in Broadsheet ink, `aria-pressed`, no red. The `s` shortcut
   stays.
2. **Front Page** (`components/FrontPage.tsx`): watch toggle on the lead story,
   value pick, and each brief card.
3. **Scouting results**: similar-players and upgrade-finder result rows and Compare
   column headers get the same control.
4. **Package moves** (`components/assistant/PackageCard.tsx`): every signing in a
   `move-list` gets "watch" next to the name — a plan you can't act on is a memo.
5. One shared component: `components/kit/WatchToggle.tsx` wrapping
   `toggleWatch`/`isWatched` from the store. No local copies.

**AC 2:**
1. A player can be added to the watch list from: ledger row, Front Page brief,
   similar results, upgrade results, package move, dossier — verified in the E2E
   flow (extend `scouting-flow.spec.ts`).
2. `WatchToggle` is the only call site of `toggleWatch` outside the store (rg
   check), and reflects state instantly on all surfaces showing the same player.

---

## 3. Tactic advice at the Squad Verdict — "how to play this shape"

**The problem.** The assistant says *what* the squad is (verdict, zone bars, gaps)
but never *how to play it*. The user asked for exactly this: "overlapping fullback
on one flank", "play through the wings", etc. And the "Best-fitting shapes" strip
(`form-chip`) is display-only — you can see 4-3-3 rates 78 but you can't click it.

**Scope:**

1. **New engine module `src/domain/assistant/style.ts`** — pure function of the
   `AnalysisContext` (XI + slots + link board), returning 2–4 deterministic,
   evidence-backed style reads. Rule sketch (thresholds in `thresholds.ts`):
   - **Overlap flank:** FB slot with high pace/stamina/crossing percentiles paired
     with an inside-cutting winger archetype → "Push {FB} on as the overlapping
     outlet on the left; {winger} cuts in and leaves him the whole flank."
   - **Play through the wings:** both wide pairs' pairScores exceed the central
     pairs by a margin → "Your width is stronger than your middle — build wide."
   - **Press or sit:** XI aggregate of work-rate/aggression/press-resistance high →
     front-foot press read; low pace at CB → "don't play a high line" warning.
   - **Direct outlet:** target-man/aerial archetype up top + deep crossers → "go
     direct early to {ST}."
   Each read carries evidence chips (the metric percentiles that fired it), doc 11
   card format.
2. **UI placement** (`components/assistant/VerdictBar.tsx`): a "How to play it"
   block directly under the Squad verdict — prose sentences, no bullets (doc 09).
3. **Formation switcher in place.** The `form-chip` strip becomes buttons: clicking
   a shape re-runs the report for it (the `tryFormation` path in `Assistant.tsx`
   already exists — wire it through `GapsPanel`). Current shape stays visually
   `current`; chips get `aria-pressed`. The style reads (§3.1) recompute per shape,
   so switching chips answers "how would we play 4-3-3?" immediately.

**AC 3:**
1. `style.ts` unit tests: a fixture XI with a fast FB + inverted winger produces
   the overlap read; a slow-CB XI produces the low-line warning; every read lists
   at least one evidence metric.
2. Clicking a formation chip re-runs the report (updates verdict, pitch, gaps,
   style reads) — DOM test + covered in the E2E flow.
3. Style block renders prose only (no `<ul>`), max 4 reads.

---

## 4. Honest funding — stop selling players the plan doesn't need

**The problem (screenshot).** With a €40M budget and an affordable plan, the
package still says "To fund it: Truffert (€67M) doesn't make your XI — selling
covers 100% of this plan." Root cause: `fundingNoteFor` (packages.ts) fires
whenever `totalCost ≥ 0.3 × cap` and any non-XI player exists — it recommends
sales for plans that are already funded.

**New rules** (`src/domain/assistant/packages.ts`):

1. **If `totalCost ≤ cap`, the package proposes no sales.** Delete the
   `fundingNoteFor` path from affordable packages entirely. `fundingPass` runs only
   when a package exceeds the cap (and for the churn package, which is sales-first
   by design).
2. **Sale proceeds are haircut, not list price.** Expected fee = **90% of value**
   (owner decision: sales average −10% of value). Applies everywhere a fee is
   projected: `fundingPass`, churn package, `expectedIncome` on the transfer board,
   price-band `ask` derivation. One constant `SALE_HAIRCUT = 0.9` in
   `thresholds.ts`.
3. **Headroom is an Assistant insight, not a package instruction.** A new low/info
   finding in the market group: "Selling {name} (≈€X after the usual haircut) would
   stretch the budget to €Y" — shown when a sellable non-XI player exists and at
   least one package used >80% of cap. The user opts into selling; the plan never
   assumes it.

**AC 4:**
1. Regression test: budget 40, plan cost ≤ 40 → package renders no sale line and no
   funding note (the Truffert case).
2. All projected fees = round(0.9 × value) — unit tests on `fundingPass`, churn,
   and `expectedIncome`.
3. The headroom insight appears only when a package used >80% of cap and a
   sellable non-XI player exists; it names the post-haircut fee.

---

## 5. Package legibility — who makes way for whom

**The problem.** A package signs five players and the user can't tell who leaves,
who benches, and what the XI actually looks like after. The `why` line per move
helps, but the aggregate picture ("5 in — so who are the 5 out?") doesn't exist.

**Scope:**

1. **Every move states its consequence inline.** Extend `PackageMove` with the
   displaced player and his fate: `out: { name, fate: "bench" | "sell" | "cover" }`.
   The move row renders "in → out" explicitly: "{Signing} takes LB — **{Incumbent}
   drops to the bench**." Fate is derived: if the incumbent appears in the
   package's sales → "sold"; if he becomes the slot backup → "cover"; else "bench".
2. **"Your XI after this window"** — a compact before/after XI list (or second
   pitch) per package: slot · current starter → new starter, changed rows
   emphasized. The data already exists (`newXi` is solved in `buildChurnPackage`
   and the funding pass); surface it.
3. **Squad-size ledger line.** One sentence per package: "5 in, 2 sold, 3 to the
   bench — squad grows to 27." The number that tells the user whether the plan is
   physically sensible.
4. **Cap the noise.** If a package has >5 moves, the card collapses depth signings
   behind "and N depth signings" — starters first.

**AC 5:**
1. Every non-depth move names the player it displaces and his fate (unit test on
   the move builder; DOM test on the card).
2. Each package renders the before/after XI diff; rows where the starter changed
   are the only emphasized rows.
3. The squad-size sentence is present and arithmetically consistent with the
   moves/sales lists (unit test).

---

## 6. Art-first dossier — the engraving is the centerpiece

**The problem.** The 36 archetype engravings (doc 18) render at 180×240 in a side
slot of the identity band — decoration, not composition. The owner wants them as
the central element of the player page.

**Scope:**

1. **Dossier hero recomposition** (`components/Dossier.tsx`, `d-hero`): the
   top-archetype engraving becomes the hero's visual anchor — a large plate
   (~300–380px wide on desktop) on the right of the name/standfirst column, ink
   hairline frame + caption ("The Line Breaker — engraving, The Scouting Post"),
   `priority` loading. The `FactsRail` moves under the plate or under the
   standfirst — pick whichever matches `design/direction-a-broadsheet.html`
   rhythm at the mock's breakpoints.
2. **Identity band keeps the small form.** `ArchetypeColumns` drops its own art
   slot (the hero now owns the image) and keeps the three columns + family icons.
3. **Sizing API.** `ArchetypeArt` gets `size: "hero" | "plate" | "thumb"`
   (≈380/240/120px) instead of one hardcoded 180×240; Front Page lead uses
   `plate` (§1.4), Compare headers may use `thumb`.
4. **No-archetype fallback:** players without a defined archetype show the
   family icon watermark, not an empty column — the composition must not collapse.

**AC 6:**
1. Dossier screenshot: the engraving is the largest single element above the fold
   after the player name; caption and frame match the Broadsheet spec.
2. `ArchetypeArt` renders three sizes via prop (unit/DOM test); no call site uses
   raw `<Image>` for archetype art (rg check).
3. A no-archetype player's dossier renders the fallback watermark with no layout
   shift.

---

## Sequencing

| Order | Work | Why first |
|---|---|---|
| 1 | §4 funding rules | Actively misleading numbers — trust bug, small diff |
| 2 | §1 Front Page | First screen, visibly broken element |
| 3 | §5 package legibility | Makes the flagship feature usable |
| 4 | §3 tactic advice + shape switcher | New engine module + wiring |
| 5 | §2 watch everywhere | Mechanical once `WatchToggle` exists |
| 6 | §6 art-first dossier | Composition work, depends on nothing above |

All work lands behind `pnpm check` green; §§1–3 extend the Playwright flow.
