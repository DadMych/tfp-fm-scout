# 17 — Engine Coherence (the verdict must not argue with the fit)

Fixes for the class of bug where two parts of the engine describe the same player in
contradictory voices. All examples below are real outputs from the 2026-07-15 build.
Read with: doc 08 (verdicts), doc 13 (sporting director), doc 11 §0 (purity rules).
Everything stays pure, deterministic, unit-tested; docs win over code.

**Who implements this:** written for an implementing agent. Every section names the
exact files, the current wrong behaviour, the required behaviour, and the tests that
prove it. Do the sections in order; each is independently committable.

---

## §1. Verdict ↔ squad-fit contradiction (the flagship bug)

**Observed:**

> PRIORITY TARGET — "Go get him — an elite wide creator at the top of this database."
> …then, same card: ROTATION — "Even with Edon Zhegrova at RW — squad depth, not a
> clear starter (−3)."

**Cause:** `decideVerdict` (`src/domain/recommendation.ts:154–174`) awards
"Priority target" from `badge === "Elite" || score >= 85` alone. The squad context
(`upgradeOver`, line 94–110) can only *promote* (margin ≥ +5 → "Squad upgrade");
a negative margin never *demotes*. The fit line and the verdict are computed from the
same numbers but never reconciled.

**Required behaviour:**

1. Extend `upgradeOver` (or add a sibling `bestMargin`) to also return the best margin
   when it is negative — today it returns `null` for anything below +5, losing the
   information that the player is *worse* than the incumbent.
2. `decideVerdict` new rule, inserted **before** the Priority-target branch:
   when squad context exists and the player's best margin across his position groups
   is **≤ 0** (he does not beat any incumbent), "Priority target" is forbidden.
   Cascade instead: `perM >= 6 && score >= 65` → "Bargain"; `age <= 20 && score >= 68`
   → "One for the future"; otherwise "Proven performer" (score ≥ 75) or "Squad depth".
3. Margin in (0, +5) — genuinely marginal: allow at most "Proven performer", never
   "Priority target" or "Squad upgrade".
4. No squad loaded (`ctx == null`): current behaviour stands (dataset-relative call is
   all we have) — but the headline must say so: "…at the top of this database" already
   does. Keep it.
5. Headline for a demoted elite must acknowledge both facts, in the desk voice:
   `"Elite ${arch} — but ${incumbentGroup} is already covered; a luxury, not a need."`
   Add a `Verdict`-independent `headlineFor` branch driven by the demotion flag.

**Tests (`src/domain/recommendation.test.ts`):**

1. Constructed elite (score 96) whose role fit is 3 below the squad's best in his only
   group → verdict is NOT "Priority target"/"Squad upgrade"; headline mentions cover.
2. Same player with squad context removed → "Priority target" (regression guard).
3. Margin +3 (0 < m < 5) → at most "Proven performer".
4. Existing tests re-baselined, suite green.

## §2. Age must temper the verdict

**Observed:**

> PRIORITY TARGET — "Go get him…" / "Age 35 — a short-term option"

The reasons list knows he is 35; the verdict does not (`decideVerdict` reads `age`
only for youth branches).

**Required behaviour** (insert before the Priority-target branch):

- `age >= 33`: "Priority target" and "Squad upgrade" forbidden → "Proven performer"
  with headline `"Elite today at ${age} — a one-season rental, price accordingly."`
- `age` 31–32: "Priority target" allowed **only if** `perM >= 6` (you are buying the
  discount, not the future). Otherwise → "Proven performer".
- Youth branches unchanged.

**Tests:** 35-year-old score 96 → "Proven performer" + rental headline; 31-year-old
score 96 at €3.2M (perM ≥ 6) → "Priority target" retained (the observed Tempo
Dictator case is *correct* on value — the bug there was §1's fit contradiction, and
at 35 this §2 rule would demote it).

## §3. Sale lines must not print a null delta

**Observed:** "€66M now vs €66M in 12 months."

**Cause:** `src/domain/assistant/transfers/sales.ts:86` prints
`projectValue(value, age + 1)` against `priceBand.ask` unconditionally.
`valueMultiplier` (`transfers/ageing.ts:45–60`) is `1.0` for `ageAtSale <= 27` —
identical numbers for anyone 26 or younger. The sell-high *arbitrage* path (value ≥
p90 + cheap shortlist twin, `sales.ts:164–167`) hits exactly this: a young star whose
value will not decay.

**Required behaviour:**

1. In `reasonsFor` case "sell-high": print the now-vs-12-months line **only when**
   `ask − projectValue(value, age+1)` ≥ max(€500K, 8% of ask). Otherwise, if the
   verdict came from the arbitrage path, say what the engine actually found:
   `"${twin.name} does the same job for ${money(twin.cost)} — bank the difference."`
   (the `ArbitrageHit` is already computed; thread it into `reasonsFor`).
2. Same guard on the "sell-now" loss line (`sales.ts:94–97`) — it already checks
   `loss > 0`; raise to the same materiality threshold.
3. General rule, stated once in this doc and enforced by review: **any projected
   figure renders only when it differs materially from the current figure.** There is
   no time-series in the product — one upload, one snapshot; every "in 12 months" is
   a doc 13 §3 model projection and must earn its ink.

**Tests (`transfers/transfers.test.ts`):** age-25 sell-high arbitrage case → no
"now vs in 12 months" string in reasons, arbitrage line present; age-31 sell-high →
line present with two different figures.

## §4. Evidence must be archetype-relevant

**Observed:** "In this database he sits in the 100th percentile for long shots" as the
lead evidence for a **Wide Creator** (long shots is not even a minor metric of it).

**Cause:** the pull-quote picks the global max percentile across all metrics, and the
logic is **duplicated in four places**: `src/report/dossier.ts:277` (`pullQuote`),
`components/Dossier.tsx:146`, `components/FrontPage.tsx:131`,
`src/report/broadsheet.ts:136`.

**Required behaviour:** extract ONE pure function — `src/domain/evidence.ts`,
`pullQuoteMetric(scores, topArchetype)` — and call it from all four sites. It ranks
candidates by `(archetype weight class) then (percentile)`, where weight class orders
`core > major > minor > everything else`, using the player's **top archetype**
(`ARCHETYPES` registry exports the weight lists). A 100th-percentile unrelated metric
loses to a 92nd-percentile core metric. Unrelated metrics may still appear, but only
when nothing core/major/minor clears the 70th percentile.

**Tests (`src/domain/evidence.test.ts`):** constructed Wide Creator with `longShots`
p100 and `crossing` p92 → picked metric is crossing, not long shots.

## §5. One fit currency inside the Sporting Director

`sales.ts:24–26` ranks squad players by `bestRole.score` (single-role ceiling) while
the XI solver, depth and needs all read `pairFit` from the active tactic preset
(`assistant/xi.ts:55`). A player can be "untouchable" on a role he never plays in
this tactic.

**Required:** `bestFit(row)` in sales (and any other SD module: pricing context,
chains, succession — `rg "bestRole" src/domain/assistant/transfers/`) switches to the
player's best `pairFit` across the preset's slots he can occupy; `bestRole.score`
remains only as the no-preset fallback, same convention as doc 16-supplementary §1.2.
Re-baseline affected tests.

**Test:** constructed player elite in a role absent from the preset, mediocre in the
slot pair he'd actually play → not "untouchable".

## §6. Sequencing & ground rules

| # | Section | Effort | Files touched |
|---|---|---|---|
| 1 | §1 verdict demotion | S | `recommendation.ts` + test |
| 2 | §2 age tempering | S | `recommendation.ts` + test |
| 3 | §3 sale-line materiality | S | `transfers/sales.ts` + test |
| 4 | §4 evidence relevance | S–M | new `domain/evidence.ts` + 4 call sites + test |
| 5 | §5 SD fit currency | M | `transfers/*` + re-baseline |
| 6+ | Part II §7–§11 below | see §11 | scoring, fit, chains, packages, rules |

Rules: `pnpm check` green after every section; no UI changes in this doc (copy
changes flow through existing components); every fix lands with the test that would
have caught it. Doc 18 (visual identity) is independent and may proceed in parallel.

---

# Part II — full engine audit (2026-07-15)

Findings from a three-zone code audit (scoring/archetypes, assistant/transfers,
recommendation/reports). Same format: current behaviour verified against code,
required behaviour, test. Line numbers are anchors, function names are the truth —
re-locate by name if lines have drifted. Severity: **[B]**ug, **[I]**ncoherence,
**[E]**nhancement.

## §7. Scoring & percentiles

**7.1 [B] Position-group percentiles depend on export column order.**
`primaryGroup` (`src/domain/scoring/dataset.ts:79`) takes `playerGroups(positions)[0]`
— insertion order. `["ST-C","AM-R"]` ranks the player among strikers,
`["AM-R","ST-C"]` among wide men: same player, different radar, different summary,
depending on how FM ordered the export. Fix: canonical group priority
`GK > CB > FB/WB > DM/CM > AM/W > ST` (document the order in doc 04) applied in
`primaryGroup`. Test: two players with permuted position arrays get identical
percentiles.

**7.2 [B] Summary superlatives mix two percentile bases.** `buildScores` feeds
`generateSummary` position-group percentiles (`percentiles`, dataset.ts:143) but
`atOrAbove` counts computed on the **whole population** ranker (`dr`, dataset.ts:144).
"One of the four best passers in this division" can attach to a group-relative 80th
percentile — chart and copy disagree. Fix: compute `atOrAbove` from the same ranker
as the displayed percentile (group), and reword superlatives to name the cohort
("one of the four best-passing centre-backs"). Fix the stale comment in
`summary.ts` claiming the input is dataset percentiles.

**7.3 [I] Radar caption lies about the cohort.** `components/Dossier.tsx:228` says
"Percentile vs outfielders in this database" while the bars are position-group
percentiles. Caption must name the actual cohort from `primaryGroup(p)`
("vs centre-backs in this database"). Same for the radar aria-label.

**7.4 [I] `topArchetype` ignores the identity floor.** `dataset.ts:173-179` returns
the best gate-passing archetype at any score (else best overall), while
`generalArchetype`/`badgeFor` require ≥ 60 for identity (doc 06 §4). A 55-score
"identity" headlines the dossier with a null badge. Fix: `topArchetype` only from
`gatesPassed && score >= 60`; below that return null and let the UI say
"no defined archetype".

**7.5 [B] Recovery Sprinter gate uses the wrong population.** Doc 06 requires
`P(speed) ≥ 75` **within CB + FB/WB**; `registry.ts:87` gates on the whole-outfield
percentile (`ScoringContext.pct`). "Fast for a defender" is the whole point of the
archetype. Fix: add an optional `cohort` field to `Gate`, build a CB∪FB/WB ranker,
use it for this gate. Test: identical speed passes as CB in a slow league, fails as
a winger.

**7.6 [I] Summary caveat picks irrelevant weaknesses.** `summary.ts` scans a fixed
`WEAK_PHRASE` map at `pct < 40`; doc 06 §10 wants physical holes at P < 20, else the
weakest metric **among the primary archetype's weighted profile**, and silence when
all relevant P ≥ 45. A Deep Progressor can be called "wasteful in front of goal"
over a metric his archetype never reads. Fix per doc; pass the primary archetype's
metric lists into `generateSummary`.

**7.7 [I] Masked players get inflated absolute role scores.** `scoreRole`
(`roles/score.ts:49`) renormalizes over known attributes only — one visible attr at
20 scores 100 with `insufficient: true`, and every list sorted by `bestRole.score`
ranks the ghost above a fully-scouted 75. Fix: when `insufficient`, cap the score at
the known-mass fraction (or exclude from rankings); surface "insufficient data"
wherever the number renders.

**7.8 [B] Stamina tax evaporates under masking.** `pairScore`
(`roles/score.ts:72-76`) skips the running tax when `workEngine` is null — a masked
stamina hides a known workRate of 6. Fix: when one component is masked, tax on the
known one (`min` of known midpoints); when both masked, no tax (unknowable is fine,
half-known is not).

## §8. Verdict & scouting-fit edge cases (extends §1)

**8.1 [B] `computeSquadFit` picks the wrong slot.** The loop
(`scouting/fit.ts:77`) keeps the slot with the highest **fit**, not the highest
**delta**. Candidate: RW fit 92 vs incumbent 90 (+2, Rotation) and an *empty* LM at
78 → engine reports "squad depth" instead of the empty-chair upgrade. Fix: select
argmax delta (empty slot ⇒ incumbentFit 0 handled as today), tie-break by fit.
Test encodes exactly this two-slot scenario.

**8.2 [B] `upgradeOver` is blind to empty position groups.**
`recommendation.ts:101` skips groups with no squad incumbent, so a shortlist CB for
a squad with zero CBs never gets the upgrade reason — while the fit column shows
"+12 into a hole". Fix: missing group ⇒ incumbent 0, reason "would fill your CB
slot — you have no natural cover". (Implement together with §1's demotion so both
read the same margins.)

**8.3 [I] "Squad upgrade" has no confidence gate.** "Priority target" requires
`conf >= 45` (`recommendation.ts:166`); "Squad upgrade" doesn't — a 30%-scouted
player carries the strongest verdict next to a "treat with caution" reason. Fix:
same gate; below it demote to "Project"/"Squad depth" with an honest headline.

**8.4 [I] "Fits a gap" accepts non-upgrades.** `lib/squad-fit-desk.ts` (`fitsGap`)
passes any non-"Not for you" verdict — Rotation depth shows under "Fits a gap" for a
thin slot. Fix: hole/weak require verdict Upgrade (or delta ≥ 8); thin/ageing may
accept Rotation. Align with doc 08 §9.5.

**8.5 [I] Two default budgets across four surfaces.** Before an Assistant run the
Front Page team report assumes €50M (`components/FrontPage.tsx:64`) while Dossier SD
block, the fit desk and the upgrades view assume unlimited (`1e12`,
`components/Dossier.tsx:113`, `lib/squad-fit-desk.ts:39`,
`components/UpgradesView.tsx:70`) — the same squad gets contradictory transfer copy.
Fix: one `DEFAULT_BUDGET` constant defined once in the domain, used by all four;
the last Assistant run's budget still wins when present.

## §9. One fit currency — full inventory (extends §5)

§5 fixed sales' `bestFit`. The same split (`bestRole.score` ceiling vs preset
`pairFit`) recurs in:

- **9.1 [B] Squad context for verdicts** — `buildSquadContext`
  (`recommendation.ts:72-86`, called from `lib/store.tsx`) compares shortlist vs
  squad on best single-role score per group and ignores the active formation, while
  the fit column uses preset pairFit. This is the *mechanism* behind §1's
  contradiction. Fix: build context from best pairFit per group under
  `lastAssistantRun.formationId` (fallback: default preset), threaded from the store.
- **9.2 [B] DEV-4 "playing out of role"** — `rules/development.ts` triggers on
  `bestRole.score − starter.pairFit ≥ 8`: different scales, false positives. Fix:
  compare pairFit at current slot vs best pairFit across preset slots.
- **9.3 [I] sell-now decline** — `sales.ts:127-129` projects decline on
  `bestRole.score` while chain readiness and succession project slot pairFit — two
  ageing stories for one player. Covered by §5's switch; verify with a test.
- **9.4 [B] Compare "role pair at slot"** — `src/domain/compare.ts` brute-forces the
  best IP×OOP combo from the whole registry while XI/fit use the preset's fixed
  pair — same slot, different number on the same screen family. Fix: use
  `getSlotPair(formationId, slotKey)`; label the column with the preset name.
- **9.5 [I] InkBar ramp** — Dossier role table renders absolute role scores through
  the five-step **percentile** ink ramp (`components/Dossier.tsx`, `kit/InkBar.tsx`)
  — colour reads as dataset standing. Fix: neutral ramp (or dedicated bar) for
  absolute fits; keep the percentile ramp for percentile bars only.

## §10. Sporting director: chains, packages, rules

**10.1 [B] Replacement chain can poach another XI starter.** `buildChain`
(`transfers/chains.ts:55-60`) searches all squad players except the one leaving —
the "ready internal heir" for the sold ST can be the current starting LW, so the
plan opens a new hole and `ready: true` is false comfort. `deriveSlots` already
excludes starters for backups (`slots.ts`); mirror that: internal candidates must
not be in `ctx.starters`. Test: versatile starter is never named heir.

**10.2 [I] Heir may simultaneously be a sell target.** `buildChain` and `buildSales`
run independently — the board can say "sell A" while B's card says "A steps in".
Fix: build sales in two passes; second pass invalidates chains whose heir has
verdict ∈ {sell-now, sell-high, release} (fall back to next candidate or
`ready: false`).

**10.3 [B] `helpsNeed` admits downgrades on thin slots.** `packages.ts:116-117`
passes any candidate with `newFit >= 62` on a non-solid slot even at negative delta
— a package can pay to make a slot worse. Fix: require `delta >= 3` whenever a
starter exists; the `newFit >= 62` branch only for empty slots.

**10.4 [B] Funding pass guards the average, not the slot.** The package funding
pass (`packages.ts`, `solveXI` shadow check) accepts a sale if global `avgFit`
holds — selling the LB starter to fund an RW upgrade passes while LB becomes a
hole. Doc 13 §7.4 requires per-slot cover (backup within `T.SUCC_READY_GAP` or a
signing at that slot). Fix per doc; test encodes the LB-for-RW scenario.

**10.5 [B] Press-conversion package filters on the wrong attribute.**
`packages.ts:258` gates on raw `workRate ≥ 13`, spec (docs 11/12) says derived
`workEngine ≥ 13` (workRate+stamina). High-workRate/low-stamina players pass, the
inverse get excluded. One-line fix + test.

**10.6 [I] RISK-4 "all-in window" ignores sales income.** `rules/risk.ts` fires on
gross `totalCost ≥ 0.9 × budgetCap`; after packages v4 a window with €40M income has
plenty of slack. Fix: use `netSpend`.

**10.7 [I] SL-3 coverage praise ignores affordability.** `rules/shortlist.ts` calls
the window "well-scouted" when every weak slot has a shortlist option at fit ≥
`WEAK_FIT` — even when the only option costs 2× the budget, contradicting the team
report's "nothing improves within budget". Fix: coverage requires
`value ≤ budgetCap`.

**10.8 [E] Slot scout actions never pass `maxValue`.** `scoutAction()` supports a
budget ceiling (`rules/helpers.ts`); SLOT-1..4 (`rules/slot.ts`) don't pass it, so
"go scout" links surface unaffordable targets. Doc 11 §4 specifies
`maxValue = budget remaining`. Fix: pass `ctx.budgetCap`.

## §11. Sequencing for Part II

| Wave | Items | Theme |
|---|---|---|
| A | 7.1, 7.2, 7.3 | percentile truth (do first — feeds every screen) |
| B | 8.1, 8.2, 9.1 (with §1) | one squad-fit story per player |
| C | 9.2–9.5, 10.1–10.5 | SD/packages correctness |
| D | 7.4–7.8, 8.3–8.5, 10.6–10.8 | tempering, gates, copy honesty |

Housekeeping alongside: doc 14 §4 still lists Front Page / Watch / Compare as
absent — reconcile; golden-players fixture has no role-ordering assertions and the
elite-share property test allows 20% vs doc 06's 15% — tighten once waves A–B land.
Known-but-unbuilt: SLOT-6 "wrong side" rule (doc 11 §4) is specified and absent —
schedule, don't lose it.
