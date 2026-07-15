# 11 — Assistant Analytics Engine (the BIG BRAIN spec)

This document specifies the full analytics assistant: a deterministic engine that turns
`(squad, shortlist, formation, budget)` into a prioritized stream of **insights** — named,
human-readable findings with evidence and actions — plus **transfer packages** and a
**team report**. It is written to be implemented mechanically: every rule has an ID, exact
trigger formula, exact thresholds, severity mapping and message template.

Read together with: doc 04 (data model), doc 05 (roles), doc 06 (archetypes),
doc 07 (squad analytics — this doc operationalizes much of it), doc 08 (scouting).

---

## 0. Ground rules

1. **Pure and deterministic.** Every module is a pure function of
   `Player[] + PlayerScores[]` (+ params). Same input, same output, no randomness,
   no LLM calls. All logic lives in `src/domain/`, UI only renders.
2. **Only real data.** We have per player: `name, age, positions[], attrs (ranged),
   club?, nationality?, value?, heightCm?, foot?, scoutGrade?`. We do NOT have wage,
   contract expiry, division, form, morale, injuries. No rule may reference missing data.
   (Rules that would want contract/wage are listed in §12 as *future*, gated on new
   export columns.)
3. **Evidence or it didn't happen.** Every insight carries the numbers that triggered it.
   The UI must be able to render "why" without recomputing.
4. **Absolute vs relative scores.** Role scores (`scores.roles[id].score`, 0–100 from
   attribute midpoints) are **absolute** → comparable across datasets (squad vs shortlist).
   Archetype scores / percentiles are **relative to their dataset** → never compare a squad
   percentile with a shortlist percentile. `slotFit` (analysis.ts) is absolute. This rule
   is load-bearing; violating it produces garbage recommendations.
5. **Don't hide bad news.** A warning ("your pivot is two of the same player") is as
   valuable as praise. Insights are never suppressed because they're negative.
6. **No PA guessing.** We never invent potential. Age + current fit is all we project.

---

## 1. Existing APIs (inventory — do not reimplement)

| API | Where | What it gives |
|---|---|---|
| `parseExport(text)` | `src/import/parse.ts` | `Player[]` + import report |
| `buildScores(players)` | `src/domain/scoring/dataset.ts` | `PlayerScores[]`: percentiles (in-dataset), `derived`, `roles` (all ~100 role ids), `archetypes`, `general`, `topArchetype`, `bestRole`, `summary`, `confidence` |
| `slotFit(scores, slot)` | `src/domain/squad/analysis.ts` | absolute 0–100 ceiling of a player at a `PositionSlot` |
| `assignXI` (private) | `analysis.ts` | greedy XI assignment — §3.1 upgrades it |
| `buildSquadPlan(params)` | `analysis.ts` | XI, slot needs, zones, formation ranking, dev notes, packages |
| `FORMATIONS`, `getFormation` | `src/domain/squad/formations.ts` | 4 shapes with pitch coords |
| `recommend(player, scores, ctx?)` | `src/domain/recommendation.ts` | per-player verdict for the Scout list |
| `computeDerived` | `src/domain/derived.ts` | 10 derived metrics (speed, aerial, pressResist, …) |
| `ATTRIBUTES`, `midOf`, `uncertainty` | domain | attribute metadata, ranged-value helpers |

Derived metric ids: `speed, workEngine, aerial, pressResist, creativity, defActivity,
defPosition, finishingPkg, mobility, physicality`.

Archetype families: `Progressor, Creator, Carrier, Runner, Finisher, Focal Point,
Destroyer, Engine, General` (+ GK families).

---

## 2. Core data types (new)

All in `src/domain/assistant/types.ts`.

```ts
export type InsightClass =
  | "shape"        // formation & structure
  | "slot"         // per-position needs
  | "age"          // age profile, succession, sell windows
  | "dna"          // squad identity vs tactic identity
  | "chemistry"    // partnerships & links
  | "setpiece"     // takers & targets
  | "physical"     // athletic profile of the XI
  | "market"       // value, bargains, overpriced, concentration
  | "development"  // gems, retraining, versatility
  | "risk"         // single points of failure, cliffs
  | "shortlist";   // shortlist coverage of the needs

export type Severity = "critical" | "high" | "medium" | "low" | "praise";
// praise = a genuine strength worth telling the user about. Never omit praise:
// a report that only nags reads like a broken sensor, not a scout.

export interface Insight {
  readonly id: string;            // rule id, e.g. "slot.hole", unique per (rule, subject)
  readonly cls: InsightClass;
  readonly severity: Severity;
  readonly title: string;         // ≤ 60 chars, headline case, e.g. "No natural left-back"
  readonly detail: string;        // 1–3 sentences, built by the phrase engine (§9)
  readonly evidence: readonly Evidence[];   // the numbers behind it
  readonly subjects: readonly string[];     // player ids involved (may be empty)
  readonly slotKey?: string;                // formation slot key when positional
  readonly action?: InsightAction;          // §8 — what the user can do about it
  readonly score: number;         // priority for ordering, §7. Higher = earlier.
}

export interface Evidence {
  readonly label: string;   // "Kroupi fit at ST"
  readonly value: string;   // "72"  (pre-formatted; UI renders verbatim)
}

export type InsightAction =
  | { kind: "scout"; filters: ScoutFilters }        // open Scout pre-filtered
  | { kind: "player"; playerId: string; dataset: "squad" | "shortlist" }
  | { kind: "package"; packageId: string }          // jump to a transfer package
  | { kind: "formation"; formationId: string };     // re-run with this shape

export interface ScoutFilters {
  readonly group?: PositionGroup;
  readonly maxAge?: number;
  readonly maxValue?: number;
  readonly minFitAtSlot?: { slot: PositionSlot; fit: number };
}

export interface AssistantReport {
  readonly plan: SquadPlan;                  // existing (XI, zones, packages, ranking)
  readonly insights: readonly Insight[];     // sorted by score desc
  readonly teamReport: TeamReport;           // §10 — the prose brief
  readonly xiV2: XiSolution;                 // §3 — optimal assignment
  readonly linkBoard: LinkBoard;             // §6 — chemistry graph for the pitch
}
```

Entry point:

```ts
// src/domain/assistant/report.ts
export function buildAssistantReport(params: PlanParams): AssistantReport;
```

`buildAssistantReport` calls `buildSquadPlan` first, then runs every rule module against
the shared `AnalysisContext`:

```ts
// src/domain/assistant/context.ts
export interface AnalysisContext {
  readonly squad: readonly PlayerRow[];
  readonly shortlist: readonly PlayerRow[];
  readonly plan: SquadPlan;
  readonly xi: XiSolution;
  readonly formation: Formation;
  readonly budgetCap: number;
  readonly byId: ReadonlyMap<string, PlayerRow>;  // squad ∪ shortlist
  readonly starters: ReadonlySet<string>;
  readonly bench: readonly PlayerRow[];
}
```

Every rule module exports `run(ctx: AnalysisContext): Insight[]` and is registered in
`src/domain/assistant/rules/index.ts`. This is the whole extension mechanism — adding
analytics later = adding one file with one `run` function.

---

## 3. XI solver v2 (`src/domain/assistant/xi.ts`)

The greedy assignment in `analysis.ts` is order-sensitive and can leave avoidable holes
(it can burn the only left-back on a CB slot). Replace for the assistant with an optimal
assignment:

### 3.1 Algorithm

Hungarian algorithm (Kuhn–Munkres) on an 11 × N cost matrix, `cost = 100 − fit`,
ineligible pairs = +∞ (player's `positions` don't include the slot). N ≤ ~40 squad
players → trivially fast. Implement in-repo (~120 lines), no dependency. If fewer than
11 eligible players exist for some slot, that slot stays empty (a hole) and the solver
runs on the remaining slots.

```ts
export interface XiSolution {
  readonly assignment: ReadonlyMap<string /*slotKey*/, { id: string; fit: number }>;
  readonly totalFit: number;      // sum of assigned fits
  readonly avgFit: number;        // rounded mean over 11 slots (empty slot = 0)
  readonly holes: readonly string[]; // slot keys with no eligible player
}
export function solveXI(rows: readonly PlayerRow[], formation: Formation): XiSolution;
```

### 3.2 Uses

- The assistant pitch renders `xiV2`, not the greedy XI.
- Package projections (before → after) MUST use `solveXI` for both sides, otherwise the
  "lift" number is noise.
- `buildSquadPlan` keeps its greedy version untouched (other callers, tests); the
  assistant layer overrides. Migrating `analysis.ts` itself to the solver is a
  follow-up, not part of this spec.

### 3.3 Second XI

`solveXI(rows minus first XI, formation)` = the **shadow XI**. Its `avgFit` is the
squad's depth number, used by rules AGE-4 and RISK-1.

---

## 4. Rule catalog — slot, shape, age (classes `shape`, `slot`, `age`)

Thresholds are constants in `src/domain/assistant/thresholds.ts` — single source, every
rule imports from there. Baseline values below; tune freely later.

```ts
export const T = {
  WEAK_FIT: 62, GOOD_FIT: 72, ELITE_FIT: 80,
  THIN_BACKUP: 55, THIN_DROP: 18,
  AGE_RISK: 32, AGE_PEAK_END: 29, AGE_PREPEAK: 24, AGE_DEV: 21,
  GEM_FIT: 66, SELL_AGE_LO: 28, SELL_AGE_HI: 30,
  PARTNERSHIP_WARN: 45, PARTNERSHIP_GOOD: 70,
  DNA_BADGE: 70,
  VALUE_CONCENTRATION: 0.4,   // one player ≥ 40% of squad value
  COVER_MIN: 2,               // players per slot incl. starter
} as const;
```

Notation: `fit(p, slot)` = `slotFit`. `XI` = xiV2 assignment. `starter(slot)` = assigned
player. `backup(slot)` = best non-starter eligible at slot.

### SHAPE — formation & structure

| ID | Trigger | Severity | Title template | Action |
|---|---|---|---|---|
| SHAPE-1 `shape.better` | `best ranked formation ≠ chosen` ∧ `bestAvg ≥ chosenAvg + 2` | high | "Your squad fits {best} better" | formation |
| SHAPE-2 `shape.confirmed` | chosen formation is ranked #1 | praise | "{formation} is the right shape" | — |
| SHAPE-3 `shape.holes-elsewhere` | chosen has 0 holes but some ranked formation has ≥ 2 | low | "Stay clear of {name}" | — |
| SHAPE-4 `shape.zone-imbalance` | `max(zone) − min(zone) ≥ 12` | medium | "Lopsided side: {strongZone} carries {weakZone}" | — |
| SHAPE-5 `shape.bench-shape` | shadow XI avgFit (3.3) ≥ chosen XI avgFit − 8 | praise | "You are two-deep in this shape" | — |

Evidence for SHAPE-1: per-formation avgFit table (already computed in
`plan.formationRanking`).

### SLOT — per-position needs

One insight per non-solid slot; solid slots with `fit ≥ ELITE_FIT` produce praise.

| ID | Trigger | Severity | Title |
|---|---|---|---|
| SLOT-1 `slot.hole` | no eligible squad player | critical | "No natural {slotLabel}" |
| SLOT-2 `slot.weak` | starter fit < WEAK_FIT | high | "{slotLabel} is a weak spot" |
| SLOT-3 `slot.thin` | backup missing ∨ backup < THIN_BACKUP ∨ drop ≥ THIN_DROP | medium | "One injury from trouble at {slotLabel}" |
| SLOT-4 `slot.ageing` | starter age ≥ AGE_RISK ∧ (no backup ≥ WEAK_FIT) | high | "{surname} won't play forever" |
| SLOT-5 `slot.elite` | starter fit ≥ ELITE_FIT | praise | "{surname} owns {slotLabel}" |
| SLOT-6 `slot.wrong-side` | starter's fit at mirrored slot ≥ fit + 5 (e.g. playing an AM-L who is better at AM-R) | low | "{surname} is on his weaker side" |

SLOT-6 detail: mirrored slot = swap `-L` ↔ `-R`; only evaluate when the mirrored slot
exists in the formation and its own starter would not lose more than the gain (compute
the 2-swap: `fit(A, mirror) + fit(B, orig) > fit(A, orig) + fit(B, mirror)` → suggest
the swap; evidence shows all four numbers). Action: none (it's a free lineup tweak;
the detail text names both players).

Every SLOT-1/2/3/4 insight gets `action: { kind: "scout", filters: … }` — position group
of the slot, `minFitAtSlot` = starter fit + 4 (or WEAK_FIT for holes), maxValue = budget
remaining. This is doc 07 §4's "analysis generates the search" implemented client-side.

### AGE — squad ageing & succession

Quality proxy for all AGE rules: `scores.bestRole.score` (absolute).

| ID | Trigger | Severity | Title |
|---|---|---|---|
| AGE-1 `age.peak-heavy` | ≥ 4 of XI aged ≥ AGE_PEAK_END | high | "This XI is ageing together" |
| AGE-2 `age.no-core` | < 3 squad players in 25–29 with fit ≥ GOOD_FIT | medium | "No peak-age core" |
| AGE-3 `age.sell-window` | player age ∈ [SELL_AGE_LO, SELL_AGE_HI] ∧ value ≥ squad p75 ∧ backup at his best slot ≥ his fit − 5 | medium | "Sell-high window: {surname}" |
| AGE-4 `age.kids-blocked` | player age ≤ AGE_DEV ∧ bestRole ≥ GEM_FIT ∧ starter at his best slot ≥ ELITE_FIT ∧ starter age ≤ 27 | low | "{surname} is blocked — loan him" |
| AGE-5 `age.youth-pipeline` | ≥ 3 squad players age ≤ AGE_DEV with bestRole ≥ GEM_FIT | praise | "The academy is feeding the first team" |
| AGE-6 `age.veteran-dependence` | XI player age ≥ AGE_RISK ∧ his slot need ∈ {thin, ageing} ∧ fit ≥ GOOD_FIT | high | "It all rests on {surname}" |

AGE-3 evidence: age, value vs squad p75 value, backup fit. Action: `player`.

---

## 5. Rule catalog — DNA, physical, set pieces (classes `dna`, `physical`, `setpiece`)

### DNA — squad identity vs tactic identity

Each formation declares a **target DNA** in
`src/domain/assistant/tactic-dna.ts` — the archetype-family counts a shape wants among
the XI (counts of players whose top archetype family matches AND top archetype score
≥ T.DNA_BADGE within the squad dataset):

```ts
export interface DnaTarget { family: ArchetypeFamily; want: number; zones?: Zone[] }
export const TACTIC_DNA: Record<string /*formationId*/, DnaTarget[]> = {
  "4-2-3-1": [
    { family: "Progressor", want: 2 }, { family: "Creator", want: 2 },
    { family: "Destroyer", want: 2 }, { family: "Finisher", want: 1 },
    { family: "Engine", want: 2 },
  ],
  "4-3-3":   [ /* Engine 3, Progressor 2, Runner 2, Finisher 1, Destroyer 1 */ ],
  "4-4-2":   [ /* Focal Point 1, Finisher 2, Engine 2, Creator 1, Destroyer 2 */ ],
  "3-5-2":   [ /* Destroyer 2, Progressor 2, Runner 2 (wing-backs), Finisher 2 */ ],
};
```

| ID | Trigger | Severity | Title |
|---|---|---|---|
| DNA-1 `dna.deficit` | per target: `have < want` | high if have = 0 else medium | "Not enough {family}s for {formation}" |
| DNA-2 `dna.surplus` | family with `have ≥ want + 2` where target exists | low | "Overloaded on {family}s" |
| DNA-3 `dna.identity` | most common XI top-archetype family (≥ 4 players) | praise | "Your identity: {family} football" |
| DNA-4 `dna.style-read` | always (one per report) | low | style sentence, §9.3 |

DNA-1 action: `scout` filtered to the families' typical position groups (constant map
family → groups in `tactic-dna.ts`).

### PHYS — athletic profile of the XI

All percentiles here are **within the squad dataset**; comparisons across the XI only.
`xiMid(metric)` = median of the XI's derived-metric raw values.

| ID | Trigger | Severity | Title |
|---|---|---|---|
| PHYS-1 `phys.slow-line` | back-4/back-3: every DEF starter raw `speed` < 12 | high | "A back line you can run past" |
| PHYS-2 `phys.no-legs` | median XI raw `workEngine` < 11 | medium | "This XI can't press for 90 minutes" |
| PHYS-3 `phys.aerial-soft` | < 2 XI outfielders with raw `aerial` ≥ 13 | medium | "Set-piece defending will hurt" |
| PHYS-4 `phys.athletic-elite` | ≥ 3 XI players with raw `speed` ≥ 15 | praise | "Pace to burn" |
| PHYS-5 `phys.one-footed-flanks` | wide starter (D/WB/M/AM at L or R) whose `foot` opposes his flank badly: left-flank player with foot = "Right" (or vice versa) | low | "{surname} plays inverted" |

PHYS-5 is a *note*, not a problem (inverted wingers are a thing) — severity stays low,
detail explains both readings.

### SP — set pieces

Raw attributes: `corners`, `freeKickTaking`, `penaltyTaking`, `longThrows`, plus
`aerial` derived for targets. Ranked over the squad.

| ID | Trigger | Severity | Title |
|---|---|---|---|
| SP-1 `sp.best-takers` | always | low | "Your dead-ball unit" (top corner/FK/pen takers with values) |
| SP-2 `sp.no-taker` | best corner taker raw < 12 ∧ best FK taker raw < 12 | medium | "Nobody to put the ball on a head" |
| SP-3 `sp.taker-is-target` | best corner taker is also top-2 `aerial` in XI | medium | "Your Aerial Monster is taking the corners" |
| SP-4 `sp.long-throw` | any squad player raw `longThrows` ≥ 14 | praise | "A long-throw weapon" |

---

## 6. Rule catalog — chemistry (`src/domain/assistant/links.ts`)

Implements doc 07 §8 against the current data. This is the highest-value new analytics.

### 6.1 Link graph

Links are declared **per formation** in `formations.ts` (extend `Formation` with
`links: readonly FormationLink[]`):

```ts
export type LinkType = "cb-pair" | "pivot" | "spine" | "wide" | "frontline" | "fb-cb";
export interface FormationLink { a: string; b: string; type: LinkType } // slot keys
```

Declarations (slot keys as they exist today):

- **4-2-3-1**: dcr↔dcl (cb-pair), dmr↔dml (pivot), dml↔amc + dmr↔amc (spine),
  dr↔amr + dl↔aml (wide), amr↔st + aml↔st + amc↔st (frontline),
  dr↔dcr + dl↔dcl (fb-cb)
- **4-3-3**: dcr↔dcl, dm↔mcr + dm↔mcl (pivot), mcr↔st + mcl↔st (spine),
  dr↔amr + dl↔aml (wide), amr↔st + aml↔st (frontline), dr↔dcr + dl↔dcl (fb-cb)
- **4-4-2**: dcr↔dcl, mcr↔mcl (pivot), mr↔str + ml↔stl (wide→frontline as `wide`),
  str↔stl (frontline), dr↔mr + dl↔ml (wide), dr↔dcr + dl↔dcl (fb-cb)
- **3-5-2**: dcr↔dc + dc↔dcl (cb-pair ×2), dm↔mcr + dm↔mcl (pivot),
  wbr↔mcr + wbl↔mcl (wide), str↔stl (frontline), mcr↔str + mcl↔stl (spine)

### 6.2 Capabilities per link type

A capability = `(derivedId | attributeId, rawThreshold)`; the pair covers it if
**either** partner's raw midpoint meets it. Raw thresholds (1–20 scale for attrs,
derived are averages of attrs so same scale):

```ts
export const LINK_CAPS: Record<LinkType, readonly Cap[]> = {
  "cb-pair":   [cap("defActivity", 12, "front-foot defending"),
                cap("speed", 12, "covering pace"),
                cap("aerial", 13, "aerial command"),
                cap("passing", 12, "ball progression")],
  "pivot":     [cap("defActivity", 12, "ball-winning"),
                cap("creativity", 12, "progression"),
                cap("pressResist", 12, "press resistance"),
                cap("workEngine", 13, "legs")],
  "spine":     [cap("creativity", 13, "creativity"),
                cap("finishingPkg", 12, "goal threat"),
                cap("defPosition", 11, "screening")],
  "wide":      [cap("speed", 13, "pace on the flank"),
                cap2("crossing", 12, "dribbling", 13, "delivery or a dribbler"),
                cap("defActivity", 10, "flank cover")],
  "frontline": [cap("finishingPkg", 13, "box finishing"),
                cap2("physicality", 12, "aerial", 12, "a focal point"),
                cap("speed", 13, "running in behind")],
  "fb-cb":     [cap("defPosition", 12, "positional glue"),
                cap("speed", 11, "recovery pace")],
};
```

(`cap2` = either-of-two-metrics capability. Labels feed the phrase engine.)

### 6.3 Partnership score

```
individual  = mean(fit(A, slotA), fit(B, slotB))                  // absolute
coverage    = 100 × covered / total
balance     = 100 − redundancyPenalty
partnership = round(0.40·individual + 0.45·coverage + 0.15·balance)
```

`redundancyPenalty`: same top-archetype **family** on a diversity-wanting link
(all types except `cb-pair` and `fb-cb`) → 40; same fine archetype id → 60; else 0.
Players without a top archetype → 0.

```ts
export interface LinkEval {
  readonly link: FormationLink;
  readonly type: LinkType;
  readonly aId: string; readonly bId: string;
  readonly partnership: number;             // 0–100
  readonly covered: readonly string[];      // capability labels, with who supplied it
  readonly missing: readonly string[];
  readonly read: string;                    // phrase engine §9.2
}
export interface LinkBoard { readonly links: readonly LinkEval[] }
export function evaluateLinks(ctx: AnalysisContext): LinkBoard;
```

### 6.4 Chemistry insights

| ID | Trigger | Severity | Title |
|---|---|---|---|
| CHEM-1 `chem.weak-link` | partnership < T.PARTNERSHIP_WARN | high | "{A} and {B} don't combine" |
| CHEM-2 `chem.redundant` | redundancyPenalty ≥ 40 | medium | "Two of the same player in the {typeName}" |
| CHEM-3 `chem.elite-link` | partnership ≥ T.PARTNERSHIP_GOOD ∧ all caps covered | praise | "{A} + {B} is a real partnership" |
| CHEM-4 `chem.missing-cap` | link has exactly 1 missing capability | medium | "Your {typeName} lacks {capability}" |

CHEM-4 action: `scout` pre-filtered to the position group of the weaker partner's slot
with `minFitAtSlot` — the signature "analysis generates the search" move.

UI: the pitch draws link lines — ink-weight by partnership, red when < 45 (doc 07 §8.5).

---

## 7. Rule catalog — market, development, risk, shortlist coverage

### MKT — market intelligence (needs `value` on both datasets)

`squadValue` = Σ value of squad. Percentiles of value within each dataset separately.

| ID | Trigger | Severity | Title |
|---|---|---|---|
| MKT-1 `mkt.crown-jewels` | one player's value ≥ T.VALUE_CONCENTRATION × squadValue | medium | "{surname} is {pct}% of your squad's value" |
| MKT-2 `mkt.bargain` | shortlist player: fit at some needed slot ≥ starter fit ∧ value ≤ 0.5 × starter value | high | "{surname} does {starter}'s job at half the price" |
| MKT-3 `mkt.grade-value-gap` | shortlist player: scoutGrade ∈ {A+, A, A−} ∧ value ≤ shortlist p40 | medium | "Scouts love him, market hasn't noticed" |
| MKT-4 `mkt.expensive-backup` | squad non-starter with value ≥ squad p75 | low | "€{value} sitting on your bench" |
| MKT-5 `mkt.budget-power` | budgetCap ≥ 1.5 × max shortlist value | praise | "Your budget covers anyone on this list" |

### DEV — development & versatility

`versatility(p)` = count of distinct position groups over p.positions.

| ID | Trigger | Severity | Title |
|---|---|---|---|
| DEV-1 `dev.gem` | bench player, age ≤ AGE_DEV, bestRole ≥ GEM_FIT (exists today as DevNote — migrate) | praise | "Development gem: {surname}" |
| DEV-2 `dev.retrain` | non-starter whose fit at a hole/weak slot ≥ WEAK_FIT − 4 but slot ∉ his positions — cross-slot fit computed ignoring position gate | medium | "Retrain {surname} as a {slotLabel}" |
| DEV-3 `dev.swiss-knife` | versatility ≥ 3 ∧ bestRole ≥ GOOD_FIT | praise | "{surname} covers half the pitch" |
| DEV-4 `dev.wasted-role` | starter whose best role (`bestRole.id`) belongs to a different slot than where he plays, and fit gap ≥ 8 | medium | "{surname} is playing out of role" |

DEV-2 mechanics: `slotFit` already ignores positions (it scores roles); the *eligibility*
gate lives in the assignment. So compute `slotFit(scores, holeSlot)` directly for every
squad player and compare against the threshold. Evidence must say "not his natural
position — needs retraining time".

### RISK — fragility board

| ID | Trigger | Severity | Title |
|---|---|---|---|
| RISK-1 `risk.no-depth-anywhere` | shadow XI avgFit ≤ chosen XI avgFit − 15 | critical | "One bad month ends your season" |
| RISK-2 `risk.spof` | player is starter at slot with no backup ∧ his fit ≥ GOOD_FIT ∧ no other squad player within 12 fit at that slot | high | "Single point of failure: {surname}" |
| RISK-3 `risk.gk-cliff` | GK starter age ≥ AGE_RISK ∧ best backup GK fit < WEAK_FIT | high | "Goalkeeping cliff ahead" |
| RISK-4 `risk.all-in-window` | every package (§8) spends ≥ 90% of cap | low | "No slack in any plan" |

### SL — shortlist coverage (meta-analysis of the shortlist itself)

| ID | Trigger | Severity | Title |
|---|---|---|---|
| SL-1 `sl.uncovered-need` | slot with need ∈ {hole, weak} ∧ zero shortlist players with fit ≥ WEAK_FIT there | high | "Your shortlist can't fix {slotLabel}" |
| SL-2 `sl.rich-vein` | ≥ 5 shortlist players with fit ≥ GOOD_FIT at one slot | low | "Deep market at {slotLabel}" |
| SL-3 `sl.everything-covered` | every non-solid slot has ≥ 1 affordable shortlist fix | praise | "The shortlist covers every gap" |

SL-1 action: `scout` (it tells the user what to go export from FM next).

---

## 8. Transfer packages v2 (`src/domain/assistant/packages.ts`)

Keep the 5 existing strategies (win-now, marquee, future, moneyball, fix-gaps). Add:

| ID | Name | Selection | Constraint |
|---|---|---|---|
| `youth-project` | The youth project | age ≤ 20, best fit gain per slot | ≤ 5 signings |
| `spine` | Rebuild the spine | only GK / D-C / DM-C / M-C / AM-C / ST-C slots, highest newFit | ≤ 3 |
| `flanks` | Overhaul the flanks | only -L/-R slots | ≤ 4 |
| `press-conversion` | The press conversion | candidates with raw `workEngine ≥ 13` ∧ `aggression ≥ 12`, prefer Engine/Destroyer family | ≤ 4 |
| `half-budget` | The disciplined window | best XI lift subject to spend ≤ 50% cap | ≤ 3 |

Rules for ALL packages (existing + new):

1. Projections use `solveXI` (§3.2) — recompute the optimal XI with the bought players
   merged in, report `beforeFit → afterFit` and the **displaced starters** (who drops
   out of the XI: list their names in the package detail as "pushes {X} to the bench").
2. Deduplicate identical move-sets across strategies (exists).
3. A package with `afterFit ≤ beforeFit` is discarded (can happen with constrained
   strategies — e.g. flanks when flanks are already elite).
4. Each package gains `insightRefs: string[]` — ids of the insights it addresses
   (match on slotKey). The UI renders "solves: No natural left-back, Ageing RCB".
5. Sort surviving packages by `afterFit` desc, tiebreak lower cost.

---

## 9. Phrase engine (`src/domain/assistant/phrases.ts`)

Deterministic template system. No LLM. Rules produce structured evidence; phrases turn
them into scout-speak. One function per rule family; shared helpers:

```ts
surname(name); listNames(names /* "A, B and C" */); money(v); fitPhrase(fit)
// fitPhrase: ≥80 "elite", ≥72 "a real starter", ≥62 "serviceable", else "a stopgap"
```

### 9.1 Rule details (`detail` field)

Each rule has exactly one template with slots, e.g.:

- SLOT-1: `"Nobody in the squad plays {slotLabel} naturally. {coverName?} can fill in
  (fit {coverFit}), but it's a patch, not a plan."`
- AGE-3: `"{surname} is {age} and worth {money}. {backupSurname} (fit {backupFit}) is
  ready — this is the window where you sell high, not the one after."`
- CHEM-2: `"Both {A} and {B} are {family}s: {familyBlurb}. In a {typeName} you need a
  second job done — right now nobody does it."`
- MKT-2: `"{surname} matches {starterSurname}'s output at {slotLabel} (fit {newFit} vs
  {oldFit}) and costs {money} against {starterMoney}."`

Full template table lives in the phrases module as a `Record<ruleId, template fn>` —
the implementer writes one small function per rule id from the tables in §4–§7.
Templates must state numbers inline (evidence is also carried separately for the UI).

### 9.2 Partnership reads (CHEM link `read`)

Pattern: `{A does X}, {B does Y} — {conclusion}.` Built from capability coverage:

- both cover different caps: `"He wins it back, {B} keeps it — they cover each other."`
- a cap covered by only one: name the supplier: `"All the running comes from {A}."`
- missing cap: `"Nobody in this pair {capabilityGap}."` (label from LINK_CAPS)
- redundancy: `"Both want the same job."`

Compose: 1 sentence when all covered, 2 when something's missing.

### 9.3 Style read (DNA-4)

One sentence from XI aggregates, first matching rule wins:

1. median `speed` ≥ 14 ∧ Runner+Engine families ≥ 4 → `"Built to run: this is a
   transition team that punishes space."`
2. Progressor+Creator ≥ 5 → `"A possession side — you'll dominate the ball and need
   runners to turn it into goals."`
3. median `aerial` ≥ 13 ∧ Focal Point ≥ 1 → `"Direct and physical — go long, win the
   second ball, feed the target man."`
4. Destroyer+Engine ≥ 5 → `"A counter-press unit: win it high, strike before the
   defence sets."`
5. fallback → `"A balanced profile with no extreme lean — tactics can go anywhere,
   which also means no built-in identity."`

---

## 10. Team report (`src/domain/assistant/team-report.ts`)

The prose brief at the top of the page — 3 paragraphs, deterministic composition:

```ts
export interface TeamReport {
  readonly headline: string;   // "Strong squad, thin margins" — from verdict + top insight
  readonly paragraphs: readonly [string, string, string];
}
```

- **P1 — state of the squad**: verdict, XI fit, best zone, worst zone, style read
  (DNA-4), shape confirmation/challenge (SHAPE-1/2).
- **P2 — the problems**: top 3 insights by score among severity ∈ {critical, high},
  joined into prose ("Three things need attention: … , … , and …"). If none: the
  praise version ("Hard to fault: …" + top 2 praise).
- **P3 — the plan**: reference the top package by name with its rationale, plus
  budget status (MKT-5 / RISK-4 if fired). If no shortlist: instruct what to export
  from FM (from SL-1-style analysis of needs: "Go scout: a left-back under 24, a
  ball-winning midfielder").

Sentence templates in the phrases module; composition is string joining, nothing fancy.

---

## 11. Prioritization, UI, files

### 11.1 Insight score (ordering)

```
score = base(severity) + clsBoost + recencyOfMoney
base: critical 1000, high 700, medium 400, low 150, praise 100
clsBoost: slot +50, chemistry +40, risk +40, age +25, market +20, else 0
praise cap: at most 5 praise insights shown by default (rest behind a toggle)
```

Stable sort; ties break by rule id (deterministic output — snapshot-testable).

### 11.2 Assistant page layout (top → bottom)

1. Brief bar (formation, budget, 80% toggle, Run) — exists.
2. **Team report** (3 paragraphs + headline) — new.
3. Verdict bar + zones — exists.
4. Pitch (xiV2) **with link lines** (§6.4) + gaps rail — extend.
5. **Insight feed** — new: filter chips by class (All / Squad / Market / Chemistry /
   Risks / Praise), each insight = one row: severity dot, title, detail, evidence
   (expandable), action button. Praise collapsed after 5.
6. Transfer plans (packages v2, with `insightRefs` chips and displaced-starter notes).

### 11.3 File layout

```
src/domain/assistant/
  types.ts          // §2
  thresholds.ts     // §4 T
  context.ts        // AnalysisContext builder
  xi.ts             // §3 Hungarian solver (+ tests with brute-force cross-check ≤ 8×8)
  tactic-dna.ts     // §5 DNA targets + family→group map
  links.ts          // §6 link evaluation
  packages.ts       // §8 strategies v2 (move from analysis.ts, keep analysis.ts API)
  phrases.ts        // §9
  team-report.ts    // §10
  report.ts         // buildAssistantReport — the only export UI touches
  rules/
    index.ts        // registry: [shape, slot, age, dna, phys, setpiece, chem, mkt, dev, risk, sl]
    shape.ts slot.ts age.ts dna.ts physical.ts setpiece.ts
    chemistry.ts market.ts development.ts risk.ts shortlist.ts
```

`formations.ts` gains `links` (§6.1). `analysis.ts` stays source-compatible.

### 11.4 Testing requirements

- `xi.test.ts`: solver vs brute force on random ≤ 8-slot instances (100 seeds, fixed
  PRNG); hole handling; beats-greedy case (the left-back burn scenario).
- Per rule module: one test per rule id — construct a minimal squad that fires it and
  one that doesn't (the tables in §4–§7 ARE the test plan).
- `links.test.ts`: coverage counting, redundancy penalty (same family / same fine /
  different), read composition.
- `report.test.ts`: snapshot of full `AssistantReport` on `samples/real/fm26_squad_view.csv`
  + `fm26_search_big.csv` — locks determinism and catches accidental reorderings.
- Everything runs under `vitest`, no DOM.

### 11.5 Implementation phases (each lands green independently)

| Phase | Scope | Done when |
|---|---|---|
| **P0** | types, thresholds, context, xi solver, report skeleton (insights = []) | xi tests pass; assistant page renders xiV2 |
| **P1** | rules: shape, slot, age + phrases for them + insight feed UI | ≥ 15 rule tests; feed renders with actions |
| **P2** | links + chemistry rules + pitch link lines | link tests; lines on pitch |
| **P3** | dna, physical, setpiece, market, dev, risk, shortlist rules | full catalog fires on real data |
| **P4** | packages v2 + team report + snapshot test | snapshot green; UI complete per §11.2 |

---

## 12. Future (blocked on new export columns — do not implement)

- Contract expiry → free-transfer hunting, expiring-starter risk (doc 07 §4 `contract`).
- Wages → wage-budget packages, wage-to-fit efficiency.
- Division/league of shortlist clubs → "steps down a level" adjustment.
- SaveSeries season deltas (doc 07 §5) → risers/decliners feed DEV rules.
- Injury proneness / natural fitness decay curves → RISK class extensions.

## 13. Acceptance examples (real datasets in `samples/real/`)

Using `fm26_squad_view.csv` (35 players) + `fm26_search_big.csv` (204):

1. Forster (GK, 37) with Paulsen/Mandas behind → RISK-3 must NOT fire (backups ≥ WEAK_FIT);
   AGE-6 fires only if his slot classifies thin/ageing.
2. Kroupi (19, fit ≥ 66, benched) → DEV-1 gem; if Evanilson (ST starter) fit ≥ 80 and
   age ≤ 27 → AGE-4 "blocked — loan him" also fires.
3. Burn (shortlist CB, fit 80, €11M) vs squad CB fit ~70 → MKT-2 or package move;
   with scoutGrade ≥ A− and value below shortlist p40 → MKT-3 too.
4. 4-2-3-1 vs 4-3-3 within 1 point → SHAPE-1 must NOT fire (needs +2 margin), SHAPE-2
   fires for the ranked-#1 shape.
5. Both DM starters from the same family → CHEM-2 on the pivot with the §9.2 read.
6. Zero shortlist GKs while GK slot thin → SL-1 "shortlist can't fix GK".
```
