# 13 — Sporting Director Layer (sell, replace, plan the window)

Docs 11/12 built the assistant that tells you what's wrong and what to **buy**. This doc
specifies the missing half of a real transfer brain: **who to sell, who replaces them,
and how the whole window balances**. It adds a new analytics layer on top of the existing
assistant engine — same ground rules, same purity, new outputs.

Read together with: doc 11 (engine spec), doc 12 (UX overhaul — its dedup/priority rules
apply to everything here), doc 07 (squad analytics), doc 04 (data model).
Where this doc touches packages, **it amends doc 12 §4** (packages v3 → v4).

Implementation note for the coding agent: every existing API referenced below is real and
verified — see §1. Do not reimplement them. All new code is pure, deterministic, lives in
`src/domain/assistant/transfers/` and is consumed by `buildAssistantReport()`.

---

## 0. Ground rules (inherited + new)

Rules 1–6 of doc 11 §0 apply verbatim. Three additions:

7. **Sales are first-class, not narrative.** Today "sell" exists only as prose hints
   (`age.sell-window`, `mkt.unused-value`, package `fundingNote`). After this doc, a sale
   is a structured object with a verdict, a price band, a named replacement and a
   simulated post-sale XI — same rigor as a signing.
8. **Only deterministic projection, never PA.** We still never invent potential. The
   ageing model (§3) projects **decline only**, from age + current attributes. A
   20-year-old is never projected to improve; a 33-year-old roadrunner is projected to
   fall off a cliff. This is market realism, not scouting fantasy.
9. **Money we don't have doesn't exist.** All financial logic uses the single field we
   actually parse: `player.value` (transfer value midpoint, may be `null`). No wage, no
   contract expiry. Every fee-based rule must skip players with `value == null`.
   Wage/contract rules stay in §15 (future), gated on new export columns.

---

## 1. Existing APIs (verified inventory — build on these)

| API | Where | What it gives |
|---|---|---|
| `buildContext(params)` | `src/domain/assistant/context.ts` | `AnalysisContext`: squad/shortlist `PlayerRow[]`, `xi`, `slots` (with `need`, `starter`, `backup`, `starterAge`), `zoneStrength`, `avgFit`, `budgetCap`, `byId`, `starters`, `bench` |
| `solveXI(rows, formation)` | `assistant/xi.ts` | Hungarian-optimal XI; **re-run it to simulate a post-sale squad** |
| `slotFit(scores, slot)` | `assistant/xi.ts` | absolute 0–100 ceiling at a `PositionSlot` |
| `deriveSlots / zoneStrengthOf / avgFitOf / verdictOf` | `assistant/slots.ts` | slot needs and verdicts |
| `buildPackages(ctx)` | `assistant/packages.ts` | packages v3 — §7 upgrades to v4 |
| `unusedValueCandidates(ctx)` | `rules/market.ts` | bench players whose value is dead weight (reuse, don't duplicate) |
| `T` | `assistant/thresholds.ts` | all thresholds; §13 adds new ones |
| `surname, listNames, money, pct` | `assistant/phrases.ts` | formatting |
| `finalize(raw)` | `assistant/priority.ts` | scoring/dedup/caps; §10 extends it |
| `midOf(attrs, id)` | `domain/attr-value.js` | raw attribute midpoints (1–20) — use these for the ageing model, **not** dataset-relative percentiles |
| `computeDerived(player)` | `domain/derived.ts` | derived metrics incl. `speed`, `mobility`, `physicality` |
| `recommend(player, scores, ctx?)` | `domain/recommendation.ts` | scout verdicts — §11.4 adds a cross-link, no logic change |

Reminder (load-bearing, doc 11 §0.4): role/slot fit is **absolute** → comparable across
squad, shortlist and simulated squads. Archetype percentiles are dataset-relative →
**never** use them in any cross-dataset or projection math. The ageing model therefore
reads raw attribute midpoints, not percentiles.

---

## 2. New core types

All in `src/domain/assistant/transfers/types.ts`.

```ts
import type { PositionSlot } from "../../positions.js";

export type SaleVerdict =
  | "untouchable"  // core starter at peak — refuse offers
  | "keep"         // default — no action
  | "sell-high"    // value peaked, replacement ready — cash out now
  | "sell-now"     // decline started/imminent — every window you wait costs money
  | "loan-out"     // young, good, blocked — develop elsewhere
  | "release";     // deadwood — any fee is a win

export interface PriceBand {
  readonly low: number;   // realistic floor (fee × 0.85)
  readonly ask: number;   // expected fee (§4.3)
  readonly high: number;  // good-negotiation ceiling (fee × 1.15)
}

export interface SaleRecommendation {
  readonly playerId: string;
  readonly verdict: SaleVerdict;
  readonly reasons: readonly string[];        // human sentences, phrase engine §12
  readonly evidence: readonly { label: string; value: string }[];
  readonly priceBand: PriceBand | null;       // null when player.value == null
  readonly xiImpact: number;                  // avgFit delta if sold today (≤ 0), §5.1
  readonly replacement: ReplacementChain | null; // best succession path, §5
  readonly urgency: "this-window" | "next-window" | "no-rush";
}

export type ReplacementSource = "internal" | "shortlist" | "none";

export interface ReplacementChain {
  readonly source: ReplacementSource;
  readonly playerId: string | null;    // heir (bench player or shortlist target)
  readonly playerName: string | null;
  readonly slot: PositionSlot;         // the slot being backfilled
  readonly fitBefore: number;          // outgoing player's fit at that slot
  readonly fitAfter: number;           // heir's fit at that slot
  readonly cost: number | null;        // shortlist price, 0 for internal, null unknown
  readonly netCost: number | null;     // cost − expected fee; negative = profit
  readonly ready: boolean;             // fitAfter ≥ fitBefore − T.SUCC_READY_GAP
}

export interface SuccessionEntry {
  readonly slotKey: string;
  readonly slotLabel: string;
  readonly starterId: string | null;
  readonly starterAge: number | null;
  readonly fitNow: number;
  readonly fitIn1: number;             // ageing model, §3
  readonly fitIn2: number;
  readonly fitIn3: number;
  readonly heir: ReplacementChain | null;
  readonly horizon: number;            // seasons until projected fit < T.WEAK_FIT (0–3, 3 = safe)
  readonly status: "secure" | "watch" | "crisis";
}

export interface SquadHealth {
  readonly index: number;              // 0–100 composite, §9
  readonly xiQuality: number;          // subscores, each 0–100
  readonly depth: number;
  readonly ageBalance: number;
  readonly succession: number;
  readonly liquidity: number;
}

export interface TransferBoard {
  readonly sales: readonly SaleRecommendation[];   // sorted: sell-now, sell-high, release, loan-out (keeps/untouchables excluded from the board but present in the full list)
  readonly all: readonly SaleRecommendation[];     // every squad player, for the dossier
  readonly succession: readonly SuccessionEntry[]; // one per formation slot
  readonly health: SquadHealth;
  readonly expectedIncome: number;                 // Σ ask over sales with a price band
}
```

`AssistantReport` (assistant/types.ts) gains one field — additive, nothing existing moves:

```ts
export interface AssistantReport {
  // ... existing fields unchanged ...
  readonly board: TransferBoard;
}
```

`InsightClass` gains one member: `"transfer"`.

---

## 3. The ageing model — `transfers/ageing.ts`

Deterministic decline projection. No growth is ever projected (ground rule 8).

### 3.1 Physical reliance

How much of a player's game is legs. Raw midpoints (1–20), not percentiles:

```
reliance = clamp01( (mid(pace) + mid(acceleration) + mid(agility) + mid(stamina)) / 4 / 16 )
```

(GK: reliance = 0.35 fixed — keepers age slowly.) Masked inputs: use the mean of the
available ones; if all four masked, reliance = 0.5.

### 3.2 Fit decay table

Projected best-role / slot fit after `n` seasons, from current age `a` and fit `f`:

| Age band (at that future season) | Base decay per season |
|---|---|
| ≤ 29 | 0 |
| 30–31 | −1.5 |
| 32–33 | −3 |
| 34+ | −5 |

Scaled by reliance: `decay × (0.5 + reliance)` → a pure technician (reliance ≈ 0.3)
loses ~0.8/season at 30; a sprinter (reliance ≈ 0.9) loses ~2.1. Apply season by season
(age increments each step), round at the end, floor at 0.

```ts
export function projectFit(fit: number, age: number | null, reliance: number, seasons: 1 | 2 | 3): number;
```

`age == null` → no decay (return `fit`); such players are also excluded from age-gated
sale verdicts.

### 3.3 Value trajectory

Expected resale multiplier of `player.value` if sold `n` seasons from now:

| Age at sale | Multiplier |
|---|---|
| ≤ 27 | 1.0 |
| 28–29 | 0.9 |
| 30 | 0.75 |
| 31 | 0.55 |
| 32 | 0.4 |
| 33 | 0.25 |
| 34+ | 0.1 |

```ts
export function projectValue(value: number, ageAtSale: number): number;
```

This is what makes "sell now vs wait" a number, not vibes: a 30-year-old worth €20M is
worth ~€11M next season and ~€8M the one after. The phrase engine quotes exactly this.

---

## 4. Sale verdicts — `transfers/sales.ts`

`buildSales(ctx: AnalysisContext): SaleRecommendation[]` — one per squad player.

### 4.1 Inputs per player

- `fit` = `scores.bestRole?.score ?? 0` (absolute)
- `role` = starter (in `ctx.starters`) / backup (some slot's `backup.id`) / fringe
- `value`, `age`
- `p75V`, `p90V` = 75th/90th percentile of squad `value`s (same helper as rules/age.ts)

### 4.2 Decision tree (first match wins — order is normative)

| # | Verdict | Conditions |
|---|---|---|
| 1 | `untouchable` | starter AND `fit ≥ T.ELITE_FIT` AND `age ≤ T.AGE_PEAK_END` |
| 2 | `loan-out` | `age ≤ T.AGE_DEV` AND `fit ≥ T.GEM_FIT` AND fringe/backup AND blocked (a starter at a shared slot has `fit ≥ T.ELITE_FIT` and `age ≤ 27` — same predicate as AGE-4 in rules/age.ts; extract it into a shared helper, do not copy-paste) |
| 3 | `release` | `age ≥ 24` AND `fit < T.DEADWOOD_FIT` AND fringe (not starter, not backup at any slot) |
| 4 | `sell-now` | `age ≥ T.SELL_NOW_AGE` AND `value != null` AND projected fit drop over 2 seasons ≥ 4 AND replacement chain (§5) is `ready` |
| 5 | `sell-high` | `value != null` AND either: (a) `T.SELL_AGE_LO ≤ age ≤ T.SELL_AGE_HI` AND `value ≥ p75V` AND internal backup within 5 fit (the AGE-3 predicate); or (b) **arbitrage**: `value ≥ p90V` AND a shortlist player exists with `slotFit ≥ starterFit − 2` at the player's XI slot costing `≤ T.ARBITRAGE_FRAC × value` |
| 6 | `keep` | everything else |

Sub-verdict `urgency`: `sell-now` → `"this-window"`; `sell-high` → `"this-window"` if
`age = T.SELL_AGE_HI` else `"next-window"`; `release`/`loan-out` → `"this-window"`;
otherwise `"no-rush"`.

### 4.3 Price band

`fee = value × ageMultiplier(age)` using the §3.3 table at `n = 0` (i.e. multiplier for
current age). For `release`, apply an extra ×0.5 desperation haircut. Band =
`{ low: fee×0.85, ask: fee, high: fee×1.15 }`, rounded to 3 significant digits.
`value == null` → `priceBand = null` and the phrase says "value unknown — get him
scouted before negotiating".

### 4.4 Every sale names its consequence

`xiImpact`: re-run `solveXI(squad \ {player}, formation)`; `xiImpact = newAvgFit − ctx.avgFit`
(≤ 0 by construction, 0 for fringe players). This is the honesty check: a recommendation
to sell a starter must show the hole it opens, in the same card.

---

## 5. Replacement chains — `transfers/chains.ts`

`buildChain(ctx, playerId): ReplacementChain | null`

For the player's **primary slot** (the formation slot he starts at; for non-starters, the
slot where his `slotFit` is highest among formation slots he's eligible for):

1. **Internal**: best bench/fringe squad player eligible at that slot by `slotFit`,
   excluding the outgoing player. `cost = 0`, `netCost = −fee`.
2. **External**: best shortlist player eligible at that slot with
   `slotFit ≥ fitBefore − T.SUCC_READY_GAP`, `value ≤ ctx.budgetCap + fee` (the sale
   funds the buy). Among qualifiers pick highest `slotFit`; tie-break lower cost.
   `netCost = value − fee`.
3. Pick the better `fitAfter` of the two; if external wins but internal is within 2 fit,
   prefer internal (free beats marginal). `ready = fitAfter ≥ fitBefore − T.SUCC_READY_GAP`.
4. Neither exists → `{ source: "none", ready: false, ... }`.

This function is also the engine for the succession board (§6) and the dossier "if sold"
panel (§11.4).

---

## 6. Succession board — `transfers/succession.ts`

`buildSuccession(ctx): SuccessionEntry[]` — one entry per formation slot:

- `fitNow` = starter fit (0 for holes); `fitIn1/2/3` = `projectFit(...)` (§3.2).
- `heir` = `buildChain(ctx, starterId)` (null for holes — the slot rule already screams).
- `horizon` = first season index (1–3) where projected fit `< T.WEAK_FIT`, else 3.
- `status`: `crisis` if `horizon ≤ 1` AND (`heir == null` OR `!heir.ready`);
  `watch` if `horizon ≤ 2` OR (`starterAge ≥ T.AGE_PEAK_END` AND no ready heir);
  else `secure`.

This is the "what rots and when" table doc 07 §2 promised but never got.

---

## 7. Packages v4 — sales become first-class (amends doc 12 §4)

`assistant/packages.ts` changes, all additive:

### 7.1 Type extensions

```ts
export interface PackageSale {
  readonly playerId: string;
  readonly playerName: string;
  readonly fee: number;             // priceBand.ask
  readonly verdict: SaleVerdict;    // why he's leaving
  readonly consequence: string;     // "backup Smith (fit 68) steps in" | "replaced by signing below"
}

export interface TransferPackage {
  // ... existing fields unchanged ...
  readonly sales: readonly PackageSale[];
  readonly income: number;          // Σ fees
  readonly netSpend: number;        // totalCost − income
}
```

### 7.2 Funding pass

After a package's signings are assembled (existing v3 logic untouched), run a funding
pass: pull candidates from `buildSales(ctx)` with verdict `sell-now`/`sell-high`/`release`
whose departure does not lower the package's `afterFit` (they're displaced by a signing,
or fringe). Attach greedily by fee (desc) while `netSpend > 0`. The old `fundingNote`
string stays but must now agree with the structured `sales` list (build it from the list).

### 7.3 New strategy: "Churn" (self-funding window)

9th strategy alongside the existing 8: maximize `afterFit − beforeFit` subject to
`netSpend ≤ 0`. Assembly: take all `sell-now`/`sell-high`/`release` fees as the budget,
run the v3 greedy fill with that budget, keep only if `afterFit > beforeFit` and at least
1 sale + 1 signing. Tagline: "Improves the XI and the bank balance at the same time."

### 7.4 Acceptance check (doc 12 style)

On the doc 12 reference run (35-player squad, 204 shortlist, €64M): every package card
shows `netSpend`, at least one package includes ≥ 1 structured sale, and "Churn" appears
iff a self-funding improvement exists. No package proposes selling a player its own
signings don't cover (a sale whose `consequence` names neither a backup ≥ fit−5 nor an
incoming signing at that slot is a bug).

---

## 8. Assembly — `transfers/board.ts`

```ts
export function buildBoard(ctx: AnalysisContext): TransferBoard;
```

Order: sales (§4) → chains attached (§5) → succession (§6) → health (§9). Called from
`buildAssistantReport()` after `buildContext`, before rules run (rules in §10 read the
board via context — pass it as a second arg to the transfer rule module only; other rule
modules do not gain new inputs).

---

## 9. Squad Health Index — `transfers/health.ts`

One number the user can track across saves, plus five subscores. All 0–100.

| Subscore | Formula |
|---|---|
| `xiQuality` | `clamp01((avgFit − 50) / 35) × 100` (50 → 0, 85 → 100) |
| `depth` | mean over slots of need score: solid = 1, thin/ageing = 0.55, weak = 0.3, hole = 0; ×100 |
| `ageBalance` | `100 − 100 × Σ |shareXI(band) − target(band)| / 2` over XI age bands with targets: ≤21: 0.1, 22–24: 0.2, 25–29: 0.45, 30+: 0.25 |
| `succession` | share of slots with `horizon ≥ 2` × 100 |
| `liquidity` | Σ value of players aged ≤ 29 / Σ all value × 100 (100 = no value trapped in declining legs); no values at all → 50 |
| **`index`** | `0.35·xiQuality + 0.20·depth + 0.15·ageBalance + 0.20·succession + 0.10·liquidity`, rounded |

Verdicts for the phrase engine: ≥ 75 "healthy", 60–74 "stable", 45–59 "creaking",
< 45 "crisis".

---

## 10. New insight rules — `rules/transfer.ts` (class `"transfer"`)

Standard rule module: `run(ctx, board): RawInsight[]`. IDs, triggers, severity:

| ID | Trigger | Severity | Message shape |
|---|---|---|---|
| `tr.board` | ≥ 1 sale with verdict sell-now/sell-high/release | high | "N players should leave this window — worth ~€X combined." Evidence: each name + ask. Action: none (the board section is the action). |
| `tr.sell-now` | per `sell-now` player | high | "€{ask} today, €{projectValue(+1)} next summer — {name} loses you money every window he stays." Subjects: player + heir. Action: `{kind:"player"}` |
| `tr.arbitrage` | per §4.2-5b arbitrage sale | high | "Sell {name} (€{ask}), sign {target} (€{cost}, fit {fitAfter} vs {fitBefore}) — same XI, €{−netCost} profit." Action: `{kind:"player", dataset:"shortlist"}` |
| `tr.succession-crisis` | per succession entry with `status = "crisis"` | critical | "{slot label} falls off a cliff: {starter} projects to {fitIn1} next season and nobody is ready." Action: `{kind:"scout", filters:{ minFitAtSlot }}` |
| `tr.value-cliff` | Σ value of 30+ players ≥ `T.VALUE_CLIFF_FRAC` × squad value | high | "€X — {pct}% of your squad's worth — is in players 30+. That money evaporates if you don't move soon." |
| `tr.self-funding` | Churn package exists | medium | "This window can pay for itself: {churn summary}." Action: `{kind:"package"}` |
| `tr.health` | always (single) | praise if index ≥ 75, medium if 45–59, high if < 45, else low | "Squad health {index}/100 ({verdict}). Weakest: {min subscore name}." |

Caps (extend doc 12 dedup rules): class `transfer` ≤ `T.TRANSFER_CLASS_CAP` (6);
`tr.sell-now` + `tr.arbitrage` combined ≤ 4, ranked by fee desc; one insight per subject
across the class (a player already in `tr.arbitrage` is dropped from `tr.board` evidence
overflow, etc. — same subject-dedup as doc 12 §3).

**Supersession**: `age.sell-window` (rules/age.ts) is retired — `tr.sell-now`/`tr.arbitrage`
+ the board replace it. Delete the rule, keep the threshold constants. `mkt.unused-value`
stays (it's about dead bench value, not a sale verdict) but its detail must reference
board asks when available.

### Priority — `priority.ts`

Class boost for `transfer`: same tier as `market` (+ existing severity base). `tr.succession-crisis` and `tr.board` additionally get the slot-hole boost (they are actionable window-planning items, the whole point of the layer).

---

## 11. UI — `components/Assistant.tsx` (amends doc 12 §5 page order)

New section **"Sporting director"**, placed directly **after Transfer plans, before the
findings feed**:

1. **Health gauge** — index + 5 subscore bars, verdict word. One row, compact.
2. **Sale board** — table of `board.sales`: name (→ dossier link), age, verdict chip
   (color: sell-now red, sell-high gold, release grey, loan-out blue), ask (band on
   hover), replacement cell ("↑ {heir} (fit {fitAfter})" internal / "buy {name} €{cost}"
   shortlist / "— no successor" warning), urgency chip. Empty state: "Nobody needs to
   leave — rare and good."
3. **Succession board** — per-slot rows: slot, starter (age), fit now → in-2 (projected,
   rendered as `74 → 68`), heir, status chip (secure/watch/crisis). Collapsed by default
   to slots with status ≠ secure; toggle shows all.
4. **Dossier addition** (`components/Dossier.tsx`, squad players only): "Exit analysis"
   block — verdict, price band, best chain, xiImpact. For shortlist players the inverse:
   "Who he replaces" — the squad player his arrival displaces (lowest-fit starter at his
   best slot) and that player's sale ask. This closes the loop with `recommend()`:
   ScoutDesk verdict says *buy him*, the dossier now says *and here's who leaves*.

Findings feed: `transfer` class maps to the existing **Market** tab (no new tab).
Package cards render `netSpend` prominently ("€38M spend − €22M sales = **€16M net**")
and list sales with consequences under the moves.

---

## 12. Phrases — `assistant/phrases.ts` additions

Deterministic templates, same voice as doc 11 §9 (a blunt sporting director, not a
euphemism machine):

- Verdict lines: `untouchable`: "Build around him. Hang up on anyone who calls." /
  `sell-high`: "His value will never be higher. The market pays for the player he was
  last season." / `sell-now`: "Every window he stays costs ~€{loss}." / `release`:
  "A fee is a bonus; the squad place is the win." / `loan-out`: "He needs minutes you
  can't give him."
- Money deltas always quote both sides: "€{ask} now vs €{projected} in 12 months."
- Health verdict lines per band (§9).

---

## 13. New thresholds — `thresholds.ts`

```ts
DEADWOOD_FIT: 55,        // release line (§4.2-3)
SELL_NOW_AGE: 31,        // decline sales start here (§4.2-4)
ARBITRAGE_FRAC: 0.6,     // replacement must cost ≤ 60% of outgoing value (§4.2-5b)
SUCC_READY_GAP: 5,       // heir within this fit of the outgoing player = ready (§5)
VALUE_CLIFF_FRAC: 0.35,  // 30+ value share alarm (§10 tr.value-cliff)
TRANSFER_CLASS_CAP: 6,   // max transfer insights shown (§10)
```

---

## 14. File plan & tests

| File | Content |
|---|---|
| `src/domain/assistant/transfers/types.ts` | §2 types |
| `src/domain/assistant/transfers/ageing.ts` | `projectFit`, `projectValue`, reliance (§3) |
| `src/domain/assistant/transfers/sales.ts` | `buildSales` (§4) |
| `src/domain/assistant/transfers/chains.ts` | `buildChain` (§5) |
| `src/domain/assistant/transfers/succession.ts` | `buildSuccession` (§6) |
| `src/domain/assistant/transfers/health.ts` | `buildHealth` (§9) |
| `src/domain/assistant/transfers/board.ts` | `buildBoard` (§8) |
| `src/domain/assistant/rules/transfer.ts` | §10 insights |
| `assistant/packages.ts` | v4: `PackageSale`, funding pass, Churn (§7) |
| `assistant/report.ts`, `types.ts`, `priority.ts`, `thresholds.ts`, `phrases.ts` | wiring, additive |
| `rules/age.ts` | delete AGE-3 (`age.sell-window`), extract shared blocked-kid predicate |
| `components/Assistant.tsx`, `Dossier.tsx` | §11 |

**Tests** (`src/domain/assistant/transfers/transfers.test.ts` + extend `rules.test.ts`,
`packages.test.ts`; vitest, synthetic fixtures like existing suites):

1. `projectFit`: technician vs sprinter at 30 diverge; ≤29 never decays; null age no-op.
2. `projectValue`: table exact; monotonic in age.
3. Decision tree: one fixture per verdict; order enforced (an untouchable who also
   matches sell-high stays untouchable); `value == null` never yields fee verdicts.
4. Chain: internal preferred within 2 fit; external respects `budgetCap + fee`;
   `ready` boundary at exactly `fitBefore − SUCC_READY_GAP`.
5. Succession: horizon boundary (projected fit exactly `T.WEAK_FIT` → not yet rotten);
   crisis requires no ready heir.
6. Health: hand-computed composite for a small fixture; empty-values liquidity = 50.
7. Packages v4: netSpend arithmetic; Churn only when self-funding; sale-consequence
   invariant of §7.4.
8. Rules: caps respected; `age.sell-window` gone; subject dedup across `tr.*`.
9. Determinism: `buildBoard` twice on same input → deep-equal.

**Acceptance checks** (doc 12 style, run on the reference squad+shortlist):

- A. Every sell recommendation card shows a named consequence (heir or signing) or an
  explicit "no successor" warning — zero naked "sell him" advice.
- B. Package cards show net spend; at least one self-funding path appears when one exists.
- C. The board never recommends selling a player whose departure drops avgFit by > 2
  without a ready replacement chain.
- D. Feed noise budget unchanged: total insights shown does not grow by more than 6 vs
  pre-13 baseline on the same input (caps working).

---

## 15. Future (blocked on data, do not build now)

- Wage off the books per sale; contract-expiry fire sales; free-agent replacement hunts —
  all need `Wage`/`Contract Expires` columns in the export (parser + `Player` extension
  first, doc 04 schema already sketches the fields).
- Multi-season plan (sell in 2 windows) — needs SaveSeries snapshots (doc 07 §5).
- League-relative value calibration (a €20M player in League One ≠ Premier League) —
  needs `Division` parsed and a division baseline table.
