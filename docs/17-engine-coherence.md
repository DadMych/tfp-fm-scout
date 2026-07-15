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

Rules: `pnpm check` green after every section; no UI changes in this doc (copy
changes flow through existing components); every fix lands with the test that would
have caught it. Doc 18 (visual identity) is independent and may proceed in parallel.
