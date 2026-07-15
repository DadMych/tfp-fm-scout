# 12 — Assistant UX Overhaul (fix the noise, spend the money)

The engine from doc 11 is live and correct, but the first real run exposed four product
failures. This document is the complete, mechanically implementable spec for fixing them.
It amends doc 11; where the two disagree, **this doc wins**.

Read together with: doc 11 (engine spec — the base), doc 07 (squad analytics).
All code paths referenced below exist under `src/domain/assistant/` and
`components/Assistant.tsx` unless said otherwise.

---

## 0. The bug report (what the user actually saw)

A real run on a 35-player squad + 204-player shortlist, 4-2-3-1, €64M cap produced:

1. **Duplicate spam.** 9 of 25 insights were `mkt.bargain`, one *per slot*: Paintsil
   appeared twice (LW + RW), Holeš twice (LCB + RCB). Three separate
   "€NM sitting on your bench" cards. Five near-identical "X + Y is a real partnership"
   praise cards. The feed reads like a broken sensor.
2. **The money isn't spent.** With a €64M cap, the 7 packages spent €11–44M and were
   all permutations of the same three defenders (Burn / Maguire / Boey), all "+2".
   "Marquee signing" proposed **Dan Burn for €11.2M** — that is not a marquee.
3. **Plans are thin.** Each move is one line ("Upgrades RCB: 80 vs 71 (+9). €11M") with
   zero player context — no age, no profile, no reason to believe, no funding plan.
4. **Contradictions and false alarms.**
   - "Two of the same player in the double pivot … Partnership: **84**" — the read says
     they fail, the number says they're good.
   - "Not enough Creators/Engines/Finishers: **0** / 2" on an XI whose players rate
     73–77 — the DNA counter only looks at `topArchetype`, so a Creator whose top
     archetype is narrowly something else counts as zero Creators.
   - Team report paragraph 2 lowercases insight titles: "brunetta does am's job…".
   - An empty "Risks (0)" tab is rendered.
5. **Page order buries the lede.** Transfer plans — the actionable output — sit below a
   25-item wall of findings.

Every section below ends with an **acceptance check** tied to one of these.

---

## 1. Scope

Four workstreams, in order:

| # | Workstream | Files touched |
|---|---|---|
| A | Insight dedup + counting fixes | `rules/market.ts`, `rules/chemistry.ts`, `rules/dna.ts`, `links.ts`, `priority.ts`, `team-report.ts`, `thresholds.ts` |
| B | Packages v3 — spend the budget, differentiate | `packages.ts`, `thresholds.ts` |
| C | UI restructure | `components/Assistant.tsx`, `app/globals.css` |
| D | Tests | `rules.test.ts`, `packages.test.ts` (new), `report.test.ts` |

Non-goals: no new data columns, no new insight classes, no changes to the XI solver,
no changes to `slots.ts` / `context.ts` contracts (only additive).

---

## 2. New threshold constants

Add to `thresholds.ts` (all tunable in one place, per doc 11 §4):

```ts
export const T = {
  // ... existing ...
  BARGAIN_MAX_SHOWN: 4,      // max bargain insights per report
  MARKET_CLASS_CAP: 6,       // max market insights total
  PRAISE_TOTAL_CAP: 3,       // was 5 — praise is seasoning, not the meal
  CHEM_PRAISE_CAP: 1,        // only the single best partnership gets a praise card
  PKG_MAX_OVERLAP: 0.5,      // Jaccard overlap ceiling between shown packages
  PKG_SPEND_FLOOR: 0.6,      // strategies marked "spender" must use ≥ this × their cap
  MARQUEE_MIN_FRAC: 0.35,    // a marquee must cost ≥ 35% of the cap
  DEPTH_PASS_MIN_FIT: 62,    // depth-pass signings must fit at least this
  PKG_MAX_SIGNINGS: 6,       // hard ceiling per package
} as const;
```

---

## 3. Workstream A — insight engine fixes

### 3.1 MKT-2 bargains: group by player, not by slot

**Current bug** (`rules/market.ts`): the rule loops over slots and emits one insight per
slot, so a two-footed winger fires twice and the feed drowns in market cards.

**New algorithm:**

```
1. For each slot with a starter whose value is known:
     find every shortlist player who (a) plays the slot, (b) fit ≥ starter fit,
     (c) value ≤ 0.5 × starter value.
2. Group hits by shortlist playerId → BargainGroup:
     { playerId, value, hits: [{slotKey, slotLabel, starterId, starterName,
       starterFit, starterValue, fit}] }
3. savings(group) = max over hits of (starterValue − value).
4. Sort groups by savings desc. Emit the top T.BARGAIN_MAX_SHOWN as ONE insight each:
     id:      mkt.bargain:{playerId}          // subject is the player now
     title:   1 hit  → "{surname} does {slotLabel}'s job at a fraction of the price"
              2+ hits → "{surname} covers {labelA} and {labelB} for a fraction of the price"
     detail:  "{surname} matches or beats {starterA} at {labelA} (fit {fit} vs {fitA})
               [and {starterB} at {labelB} (fit {fit} vs {fitB})] — for {money(value)}
               against {money(starterAValue)}[ / {money(starterBValue)}]."
     evidence: one pill per hit + one for the bargain's own value.
     subjects: [playerId, ...starterIds]
     action:  { kind: "player", playerId, dataset: "shortlist" }
```

Multi-slot phrasing uses `listNames` for labels. `slotKey` on the insight: omit (it now
spans slots).

**Acceptance (fixes 0.1):** the same shortlist player can produce at most **one** market
bargain card, and the report shows at most `T.BARGAIN_MAX_SHOWN` of them.

### 3.2 MKT-4 bench value: one card, and it becomes the funding plan

Replace the per-player `mkt.expensive-backup` loop with a single insight:

```
candidates = bench players with value ≥ squad value p75 (as today)
if candidates.length > 0:
  id:       mkt.unused-value          (subject: "bench")
  severity: medium (was low — this is real money)
  title:    "{money(total)} of talent isn't making your XI"
  detail:   "{listNames(names)} are worth {money(total)} combined and none of them make
             your best XI. Selling even one funds most of the plans below."
  evidence: one pill per player (name: value), plus Total.
  subjects: all candidate ids
```

Export the candidate list for reuse by packages (§4.5): add to `rules/market.ts`
a named export `unusedValueCandidates(ctx): { row: PlayerRow; value: number }[]`
(pure function, same filter), so `packages.ts` doesn't re-derive it.

**Acceptance (fixes 0.1):** exactly 0 or 1 "unused value" card regardless of bench size.

### 3.3 Chemistry: cap praise, fix the redundancy contradiction

In `rules/chemistry.ts`:

1. **Praise cap.** Collect all links with `partnership ≥ T.PARTNERSHIP_GOOD` and
   `missing.length === 0`; emit a praise card only for the **single best** one
   (`T.CHEM_PRAISE_CAP`). If ≥ 3 links qualify, emit instead ONE summary praise:
   - id `chem.board-strong`, title `"The XI is chemically sound"`,
   - detail: `"{n} of {total} partnerships rate {PARTNERSHIP_GOOD}+ — the best is
     {A} + {B} ({typeName}, {score}/100)."`
   - evidence: one pill per qualifying link.
2. **Redundancy only when it costs something.** Emit `chem.redundant` **only if**
   `partnership < T.PARTNERSHIP_GOOD || missing.length > 0`. A redundant-but-covered
   pair is not a problem worth a card.
3. **Fix the read** in `links.ts` `buildRead`: the current text
   `"Both want the same job — nobody covers what the other lacks."` is emitted even when
   `missing.length === 0`, which contradicts a high score. New logic:

```
if (redundant && missing.length > 0)  → "Both want the same job — and nobody brings {missing list}."
if (redundant && missing.length === 0) → "Similar profiles — the job gets done, but they
                                          duplicate rather than complement each other."
// non-redundant branches unchanged
```

**Acceptance (fixes 0.1 + 0.4):** at most 1 chemistry praise card; a pair with
partnership ≥ 70 and nothing missing is never described as failing.

### 3.4 DNA counting: family strength, not top-archetype identity

**Current bug** (`rules/dna.ts` `haveByFamily`): a player counts toward a family only if
his single `topArchetype` belongs to it AND scores ≥ `T.DNA_BADGE`. Result: an XI of
76-fit players reports "0 Creators / 0 Engines / 0 Finishers".

**Fix.** Count via **family-best score across all archetypes**:

```ts
import { getArchetype } from "../../archetypes/registry.js";

function familyBest(row: PlayerRow, family: GeneralFamily): number {
  let best = 0;
  for (const a of row.scores.archetypes) {
    if (getArchetype(a.id).family !== family) continue;
    if (a.score > best) best = a.score;   // gate-failed scores are already capped at 40
  }
  return best;
}
// player counts toward `family` iff familyBest(row, family) ≥ T.DNA_BADGE
```

A player may now legitimately count toward two families (e.g. Engine + Destroyer) —
that is correct: he can do either job. Keep deficit/surplus thresholds unchanged.
Evidence for a deficit must now name the nearest misses:

```
detail (deficit): "{formation} wants {want} {family}s in the XI (family score
  {DNA_BADGE}+); you have {have}. Closest: {surname} ({score}), {surname} ({score})."
```

(“Closest” = top-2 XI players by `familyBest` below the threshold.)

**Acceptance (fixes 0.4):** on the reference dataset (fm26_squad_view.csv, 4-2-3-1) the
Creator/Engine/Finisher counts are no longer all zero, and any remaining deficit card
names the two nearest players with their scores.

### 3.5 Priority: per-class caps and subject-dedupe

`priority.ts` `finalize` gains two steps between scoring and sorting:

1. **Class caps:** after sorting, keep at most `T.MARKET_CLASS_CAP` market insights and
   `T.PRAISE_TOTAL_CAP` praise insights (drop lowest-scored beyond the cap). No caps on
   other classes — they're already bounded by slot/link counts.
2. **Subject dedupe:** if two insights share the same rule prefix (text before `:` in the
   id) **and** identical sorted `subjects`, keep the higher-scored one. (Belt-and-braces
   against future per-slot loops re-introducing duplicates.)

### 3.6 Team report: stop mangling titles

`team-report.ts` paragraph 2 currently does `i.title.toLowerCase()`, producing
"brunetta does am's job…". Replace composition:

```
p2 (urgent path):  "Top priorities: {titles joined with '; '}."     // original casing
p2 (praise path):  "What's working: {titles joined with '; '}."     // original casing
```

Also: the urgent list must **skip insights of class `market`** — bargains are
opportunities, not problems, and they were crowding out real issues. Take the top 3
urgent from classes ∈ {slot, risk, chemistry, age, shape, dna, physical, shortlist}.

**Acceptance (fixes 0.4):** paragraph 2 preserves title casing and never leads with a
bargain.

---

## 4. Workstream B — packages v3

### 4.1 Data contract (additive changes to `packages.ts`)

```ts
export interface PackageMove {
  // ... existing fields ...
  readonly age: number | null;
  readonly profile: string;   // "28 · Destroyer · best role: Stopper CB (81)"
  readonly why: string;       // one full sentence, see §4.6 (replaces bare `headline` in UI)
}

export interface TransferPackage {
  // ... existing fields ...
  readonly capUsed: number;        // totalCost / capForThisStrategy, 0..1
  readonly remaining: number;      // capForThisStrategy − totalCost
  readonly depthGain: number;      // shadow-XI avgFit delta (see §4.4)
  readonly fundingNote: string | null;  // see §4.5
  readonly solves: readonly string[];   // insight ids addressed (doc 11 §8 rule 4 — implement now)
}
```

`profile` is built from real data only: `age` (or "—"), top archetype **family** (via
`getArchetype(topArchetype.id).family`), and `bestRole` name + score
(`getRole(bestRole.id).name`). No invented adjectives.

### 4.2 Strategy table v2

Replace the `STRATEGIES` array. `spender: true` means the strategy's *job* is to convert
budget into quality and it must reach `T.PKG_SPEND_FLOOR` × its cap or be discarded.

| id | name | max | capFraction | spender | selection (sort of candidate pool) |
|---|---|---|---|---|---|
| `galactico` | The statement window | 2 | 1.0 | yes | newFit desc, **cost desc** tiebreak — buy the biggest names that fit |
| `win-now` | Win now | 6 | 1.0 | yes | newFit desc, cost desc tiebreak |
| `marquee` | Marquee signing | 1 | 1.0 | yes | among candidates with cost ≥ T.MARQUEE_MIN_FRAC × cap: newFit desc. **If none qualify, no marquee package.** |
| `moneyball` | Moneyball | 5 | 1.0 | no | delta/cost desc (existing) |
| `foundations` | Fix the gaps | 5 | 1.0 | no | need severity asc, then cost asc (existing) |
| `future` | Build for the future | 5 | 1.0 | no | age ≤ 23; newFit desc, age asc |
| `youth-project` | The youth project | 5 | 1.0 | no | age ≤ 20; delta desc |
| `spine` | Rebuild the spine | 4 | 1.0 | yes | central slots; newFit desc |
| `flanks` | Overhaul the flanks | 4 | 1.0 | yes | flank slots; newFit desc |
| `press-conversion` | The press conversion | 4 | 1.0 | no | workRate ≥ 13 ∧ aggression ≥ 12; newFit desc |
| `half-budget` | The disciplined window | 3 | 0.5 | no | delta desc (existing) |

Note the sort change for spender strategies: cost **desc** as tiebreak (was asc). The
point of "Win now" with money available is Malcom at €57M, not a fourth €10M defender.

### 4.3 Assembly: two passes

```
assemble(pool, cap, strat):
  PASS 1 (starters): as today — walk sorted pool, skip used players/slots,
    skip unaffordable, stop at strat.max.
  PASS 2 (depth spend) — only if strat.spender:
    while remaining ≥ min cost in pool AND picks < T.PKG_MAX_SIGNINGS:
      next = best remaining candidate (same sort) such that:
        - player not already picked
        - cost ≤ remaining
        - EITHER a new slot (unused) with newFit ≥ T.DEPTH_PASS_MIN_FIT
          OR an already-strengthened slot where he'd be the new backup with
            fit ≥ T.THIN_BACKUP (kind := "depth")
      if none → break
      pick it
  DISCARD RULE: if strat.spender and totalCost < T.PKG_SPEND_FLOOR × cap → return [].
```

Pass 2 is what turns "€22M of a €64M cap" into a real window. Depth picks get
`kind: "depth"` and their `why` says so explicitly ("comes in as first-choice cover
for {starter}").

### 4.4 Differentiate packages: depth gain + overlap filter

Two identical-looking "+2" packages must either differ in composition or not both appear.

1. **depthGain:** for each package, also compute the *shadow* XI (squad + buys, minus
   the new first XI — reuse `solveXI` on the leftover rows) before and after;
   `depthGain = afterShadowAvg − beforeShadowAvg`. Surfaces the real difference between
   "3 starters" and "2 starters + 2 depth" plans that share an afterFit.
2. **Overlap filter** in `buildPackages`, after building and sorting all candidates by
   `afterFit desc, totalCost asc`:

```
accepted = []
for pkg in sorted:
  if any(jaccard(players(pkg), players(a)) > T.PKG_MAX_OVERLAP for a in accepted): skip
  accepted.push(pkg)
```

Jaccard = |intersection| / |union| of playerId sets. This kills the Burn/Maguire/Boey
permutation parade: the best of them survives, the clones die.

**Acceptance (fixes 0.2):** on the reference dataset with a €64M cap:
(a) at least one shown package spends ≥ 60% of the cap;
(b) no two shown packages share more than half their players;
(c) "Marquee signing" costs ≥ €22.4M (35% of 64) or is absent.

### 4.5 Funding note

Using `unusedValueCandidates(ctx)` from §3.2: if the package's `totalCost` exceeds 30%
of the cap and unused-value candidates exist, set:

```
fundingNote = "To fund it: {surname} ({money}) [and {surname} ({money})] don't make
               your XI — selling covers {pct}% of this plan."
```

Pick the fewest candidates whose summed value ≥ totalCost (greedy, largest first);
if even the full list covers < 50%, say "…covers {pct}% of this plan." with the real
number. Null when no candidates or cheap package.

### 4.6 Move `why` templates (one sentence each, by kind)

```
fill:       "{surname} ({profile}) fills a slot nobody in the squad plays — fit {newFit}."
upgrade:    "{surname} ({profile}) takes {slotLabel} from {oldSurname}: {currentFit} → {newFit}."
succession: "{surname} ({profile}) is the succession plan behind {oldSurname} ({age})."
depth:      "{surname} ({profile}) comes in as first-choice cover at {slotLabel} (fit {newFit})."
```

`oldSurname` = displaced/current starter at that slot (from ctx). Keep the numeric
`headline` field for tests; UI renders `why` + `profile`.

### 4.7 Rationale v2 (3 sentences, deterministic)

```
S1 (what):   "Sign {listNames(surnames)} for {money(totalCost)} — XI {before} → {after}
              ({afterVerdict}){depthGain > 0 ? ", second XI +" + depthGain : ""}."
S2 (spend):  "Uses {pct(capUsed)} of the {money(cap)} budget, {money(remaining)} left over."
S3 (cost of business): displaced.length > 0
              ? "{listNames(displaced)} drop to the bench{fundingNote ? " — " + fundingNote : "."}"
              : fundingNote ?? ""
```

**Acceptance (fixes 0.3):** every shown package has ≥ 3 sentences of rationale, every
move has a profile line and a why-sentence naming the player it replaces or covers.

---

## 5. Workstream C — UI restructure (`components/Assistant.tsx`)

### 5.1 Page order (top → bottom)

1. Controls (`.brief`) — unchanged.
2. Team report (3 paragraphs) — unchanged position.
3. Verdict bar + pitch + gaps grid — unchanged.
4. **TRANSFER PLANS** — *moved above the findings feed.* Plans are the product;
   findings are the appendix.
5. Scouting report (findings feed).
6. "What's working" praise strip (see 5.4).

### 5.2 Plan card anatomy

```
┌────────────────────────────────────────────────────────────┐
│ WIN NOW                          74 → 78  +4   · Strong    │
│ The best available talent, age no object                   │
│ ████████████████████░░░░  €58.4M of €64M cap   (91%)       │
│                                                            │
│  Malcom          RW   27 · Runner · best role: Winger (79) │
│                       Takes RW from Scott: 76 → 79.  €57M  │
│  Dan Burn        RCB  33 · Destroyer · Stopper CB (81)     │
│                       Takes RCB from Senesi: 71 → 80. €11M │
│  ...                                                       │
│                                                            │
│ Bench: Senesi, Jiménez        Second XI: +3                │
│ To fund it: Bischof (€70.5M) doesn't make your XI —        │
│ selling covers 100% of this plan.                          │
└────────────────────────────────────────────────────────────┘
```

Implementation notes:

- Spend meter: a horizontal bar `.spend-meter` — `<i style={{width: pct}}/>` over a
  track, label right-aligned `{money(totalCost)} of {money(cap)}`. Color: `var(--ink)`
  normally, `var(--red)` when capUsed > 0.95.
- Each move = two lines: line 1 name (link to dossier) + slot chip + `profile`;
  line 2 `why` + cost right-aligned.
- Footer: displaced chips (`.bench-chip`), `depthGain` when > 0, `fundingNote` italic.
- Plans render in a single column (`.plans` grid → 1 col ≥ desktop 2 col max), each
  card full-width enough to breathe. Current 3-across cramped grid is gone.

### 5.3 Findings feed

- **Hide empty tabs**: don't render a tab whose count is 0 (fixes "Risks (0)").
- **Praise leaves the feed**: `severity === "praise"` items are excluded from the tabs
  and rendered in the §5.4 strip instead. Tab counts reflect that.
- **Default collapse**: show the top 8 by score; a single `Show all {n} findings`
  button expands. State resets on re-run.
- Evidence pills unchanged.

### 5.4 "What's working" strip

At the very bottom: horizontal row of green-tinted mini-cards (`.praise-strip`), one per
praise insight (≤ `T.PRAISE_TOTAL_CAP` = 3): title + one-line detail. This keeps praise
without letting it pad the problem list.

### 5.5 CSS additions (`app/globals.css`)

New classes: `.spend-meter`, `.spend-meter i`, `.move-profile`, `.move-why`,
`.bench-chip`, `.funding-note`, `.praise-strip`, `.praise-card`, `.show-all-btn`.
Follow existing token palette (`--ink`, `--red`, `--gold`, `--green`, `--rule`,
`--paper`); no new colors. Plans grid: `grid-template-columns: 1fr` below 1100px,
`repeat(2, 1fr)` above.

**Acceptance (fixes 0.5 + 0.1):** plans appear before findings; no empty tabs; at most
8 findings visible before expanding; praise appears only in the bottom strip.

---

## 6. Workstream D — tests

Update/add (all vitest, follow existing test style with synthetic squads):

| Test | Asserts |
|---|---|
| `rules.test.ts` mkt.bargain grouping | a shortlist player eligible at 2 slots yields exactly 1 bargain insight listing both slots |
| `rules.test.ts` mkt.unused-value | 3 expensive bench players yield exactly 1 insight with all 3 in evidence |
| `rules.test.ts` chem praise cap | squad with 5 great links yields ≤ 1 chemistry praise insight |
| `rules.test.ts` chem.redundant gating | redundant pair with full coverage and partnership ≥ GOOD yields **no** `chem.redundant` |
| `rules.test.ts` dna family counting | player whose top archetype is family A but has a ≥ DNA_BADGE archetype in family B counts toward B |
| `packages.test.ts` (new) spend floor | spender strategy result on rich shortlist with big cap spends ≥ PKG_SPEND_FLOOR × cap or is absent |
| `packages.test.ts` overlap filter | two candidate packages sharing > 50% players → only one shown |
| `packages.test.ts` marquee floor | no affordable candidate ≥ 35% of cap → no marquee package |
| `packages.test.ts` depth pass | spender with leftover budget adds a depth move (kind "depth") when an affordable ≥ DEPTH_PASS_MIN_FIT candidate exists |
| `packages.test.ts` fields | every move has non-empty `profile` and `why`; every package has `capUsed ∈ [0,1]`, rationale ≥ 3 sentences (split on ". ") |
| `report.test.ts` (update) | real-data run: bargain insights ≤ BARGAIN_MAX_SHOWN; market insights ≤ MARKET_CLASS_CAP; praise ≤ PRAISE_TOTAL_CAP; no two packages overlap > 0.5; p2 of team report contains no lowercased player surname (regex: no `[a-z]` immediately after "priorities: ") |

Keep the existing determinism / budget-cap / brute-force tests green.

---

## 7. Implementation order

| Phase | Content | Done when |
|---|---|---|
| P0 | §2 thresholds + §3 all engine fixes | rules tests (new + old) pass; real-data smoke shows ≤ 6 market cards, no dupes |
| P1 | §4 packages v3 | packages tests pass; smoke shows ≥ 1 package spending ≥ 60% cap, all rationale 3 sentences |
| P2 | §5 UI | build clean; CDP screenshot shows new order + spend meters |
| P3 | §6 report.test.ts updates + full suite + `npm run build` | 100% suite green |

Smoke command (used in prior sessions — reuse):

```bash
npx tsx -e '…parse samples/real/fm26_squad_view.csv + fm26_search_big.csv,
buildAssistantReport(4-2-3-1, €120M, useFullBudget=false), print insights + packages…'
```

---

## 8. Final acceptance checklist (mirror of §0)

- [ ] 0.1 No duplicate findings: one card per bargain player, one unused-value card,
      ≤ 1 chemistry praise, class caps enforced.
- [ ] 0.2 Money gets spent: spender packages reach ≥ 60% of cap or die; marquee is a
      real marquee; overlap filter kills permutation clones; depth pass consumes
      leftover budget.
- [ ] 0.3 Plans are rich: profile line + why-sentence per move, 3-sentence rationale,
      funding note, depth gain, spend meter.
- [ ] 0.4 No contradictions: redundancy read matches the score; DNA counts by family
      strength; team report keeps casing and leads with real problems.
- [ ] 0.5 UX order: plans above findings, no empty tabs, feed collapsed to 8, praise
      in its own strip at the bottom.
