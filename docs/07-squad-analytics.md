# 07 — Squad Analytics

Turns a squad dataset (or a club filter within a database dataset) into management-level insight. All modules below live in `src/domain/squad/` (pure functions over `Player[] + PlayerScores[]`) and render on the **Squad** screen (doc 09 §4).

"The squad" = players whose `club` equals the selected club. If the dataset is a pure squad export, the club is auto-selected.

## 1. Depth chart per tactical slot

The user defines (or picks a preset) **tactic template**: 11 slots, each = position slot + IP role + OOP role, e.g. `DM: Half-Back (IP) + Screening DM (OOP)`.

For every slot, rank squad players by `pairScore` (doc 05 §4). Output per slot:

```
slot, rankedPlayers[{playerId, pairScore, confidence, isNaturalPosition}],
depthStatus: 'strong' | 'thin' | 'critical'
```

- `depthStatus`: `strong` = ≥ 2 players with pairScore ≥ 60 natural in position; `thin` = exactly 1; `critical` = 0.
- Non-natural players (position not covering slot) are listed but flagged — they are retraining candidates, ranked after naturals regardless of score.
- Presets shipped in v1: **4-2-3-1**, **4-3-3**, **4-4-2**, **3-5-2** — defined in `src/domain/squad/tactic-presets.ts` with sensible IP/OOP pairs per slot. (Canonical set matches doc 11 / current code; older drafts listed 3-4-3 and 5-3-2 — retired.)

**Pitch view**: SVG pitch with the 11 slots, each showing top-2 names + score chips, colored by `depthStatus`. This is the screen users screenshot — make it beautiful (doc 09).

## 2. Age-profile curve

Classic squad-planning scatter: x = age, y = a *quality proxy*, one dot per player.

- Quality proxy = player's **best natural-position pairScore** for the selected tactic (fallback: best role score) — never a FIFA overall.
- Background bands: `<21 development`, `21–24 pre-peak`, `25–29 peak`, `30+ decline` (physical-attribute peak knowledge; bands are constants, easily tuned).
- Insight callouts generated as data (UI renders them as text chips), rules in `src/domain/squad/age-insights.ts`:
  - "Peak-heavy: N of your best XI are 29+" (≥ 4 triggers),
  - "No succession at {slot}: best player is {age}, next natural is {score} points worse",
  - "Sell-window: {player} is 28–29, high value, with a ready replacement".

## 3. Squad DNA fingerprint

> **Superseded in the Assistant layer (docs 11–12):** the live product counts **general archetype families** (Progressor, Creator, …) with the doc 12 family-best fix, not fine-archetype counts. The spec below remains the target for the standalone Squad screen (doc 15, phase P2).

From doc 06 §5: per archetype, count of squad players scoring ≥ 70. Rendered as a horizontal bar fingerprint, with a comparison overlay:

- vs **division median** (computed across all clubs when the dataset is a full-database export; hidden for squad-only datasets),
- vs a **target profile**: each tactic preset declares desired DNA (e.g. gegenpress preset wants ≥ 4 Press Machines, ≥ 2 Press Resisters, ≥ 1 Recovery Sprinter). Deficits render red → these become **gap cards**.

## 4. Gap analysis → scouting handoff

`findGaps(squad, tactic)` returns prioritized needs:

```
{ kind: 'depth', slot, severity }                 // from §1 critical/thin
{ kind: 'dna', archetypeId, have, want, severity }  // from §3
{ kind: 'succession', slot, agingPlayerId }         // from §2
{ kind: 'contract', playerId, expiresInMonths }     // expiring ≤ 12 months & pairScore ≥ 60
```

Each gap card has one action: **"Scout for this"** → opens the Scout screen (doc 08) with filters pre-filled (position, min archetype/role score, age ceiling for succession gaps). This closing of the loop — *analysis generates the search* — is the product's signature move.

## 5. Season-over-season deltas (requires SaveSeries)

When ≥ 2 datasets exist in a series, per `playerIdentity`:

- attribute deltas (midpoint now − then), rendered as green/red deltas on player pages and a "Development" squad tab (top risers / top decliners by summed weighted delta over the player's best-archetype core attributes);
- squad-level: DNA fingerprint drift, age-curve animation between seasons.

No forecasting in v1 — display deltas only, no PA guessing (no-cheating principle).

## 6. Set-piece coverage (cheap win, ship in v1)

Table of best takers: corners, free kicks, penalties, long throws — top 3 by the raw attribute with age & foot. Flag if best corner taker is also the main aerial target ("your Aerial Monster is taking the corners").

## 7. The reference squad (the lens for everything)

Squad analytics is not a screen you visit once — it is the **lens the whole app looks through**. The user nominates one club as their **reference squad** (auto-selected for a squad-only export; chosen from a club dropdown in a database export). Once set, it is stored per user (per `SaveSeries` when one exists) and every other screen — the Ledger, the Dossier, Compare — can answer "…and what does this mean for *my* team?"

The reference squad carries its **active tactic template** (doc 07 §1) with it. When it is set, the Scout and player screens unlock the "Where he fits your side" analysis (doc 08 §9), and the Front Page grows a standing Team Report brief. When it is not set, those surfaces simply hide — no empty states pretending to have an answer.

`src/domain/squad/reference.ts` exposes the reference squad as `{ players, scores, tactic, slotIncumbents }`, where `slotIncumbents[slot]` = the current best natural starter for each slot (top `pairScore`, natural position, from §1). Everything in §8–§9 is a pure function of this object plus a candidate player.

## 8. Partnerships & chemistry (who plays well with whom)

A player is not signed into a vacuum; he is signed **next to people**. This module answers "who does he work best with?" and "does this pairing balance or duplicate?" It is deterministic and explainable — no hidden "chemistry" magic, just football logic written down.

### 8.1 The link graph

Each tactic template declares which slots are **linked** — the adjacencies that actually have to combine on the pitch. Defined per preset in `tactic-presets.ts`, e.g. for 4-3-3: `CB↔CB`, `CB↔DM`, `DM↔CM` (both), `FB↔W` (each side), `W↔ST` (each side), `CM↔ST`, `FB↔CB` (each side). A link has a **type** drawn from a fixed set: `centre-back pair`, `pivot` (DM–CM / double pivot), `central spine` (DM/CM–AM/ST), `wide combination` (FB/WB–W), `front line` (W/AM–ST, ST–ST). The type — not the raw slots — decides what a good partnership needs.

### 8.2 Link requirements

Each link **type** owns a short list of **capabilities** that the pair, taken together, must cover. A capability is a `(metric, percentileThreshold)` predicate; the pair covers it if **either** partner meets it. Requirements live in `src/domain/squad/link-requirements.ts`. Illustrative:

| Link type | Capabilities the pair must cover (either partner) |
|---|---|
| **centre-back pair** | aggressive front-foot defending (`P(defActivity) ≥ 60`); covering pace (`P(speed) ≥ 55`); aerial command (`P(aerial) ≥ 60`); ball progression (`P(passing) ≥ 55`) |
| **pivot** | ball-winning (`P(defActivity) ≥ 60`); progression (`P(creativity) ≥ 60`); press-resistance (`P(pressResist) ≥ 55`); legs (`P(workEngine) ≥ 60`) |
| **central spine** | creativity (`P(creativity) ≥ 65`); goal threat (`P(finishingPkg) ≥ 60`); defensive screening (`P(defPosition) ≥ 55`) |
| **wide combination** | width/overlap (`P(speed) ≥ 60` on at least one); crossing or cut-in creativity (`P(crossing) ≥ 55` **or** `P(dribbling) ≥ 65`); defensive cover on the flank (`P(defActivity) ≥ 50`) |
| **front line** | penalty-box finishing (`P(finishingPkg) ≥ 65`); hold-up/aerial focal point (`P(physicality) ≥ 60` **or** `P(aerial) ≥ 60`); running in behind (`P(speed) ≥ 60`) |

### 8.3 Partnership score

For two players A, B in a link of a given type:

```
individual   = mean(pairScore(A, slotA), pairScore(B, slotB))          // doc 05 §4, 0–100
coverage     = 100 × (covered capabilities / total capabilities of the link type)
balance      = 100 − redundancyPenalty                                  // see below
partnership  = 0.40 × individual + 0.45 × coverage + 0.15 × balance
```

**redundancyPenalty** encodes "two of the same thing don't combine": if A and B share the **same general archetype family** (doc 06 §9) *and* the link type is one that wants diversity (every type except `centre-back pair` in a back-two where twin stoppers are simply bad, and `front line` where twin poachers are penalised) → penalty 40; if they share the same **fine** archetype → penalty 60; otherwise 0. Complementary families (one Destroyer + one Progressor in a pivot; one Focal Point + one Finisher up front) get penalty 0 and naturally score high on coverage — that is the reward, we don't double-count it with a bonus.

`partnership` returns with a one-line **plain-language read** built from which capabilities each partner supplied, e.g. *"He wins it back, your No. 8 keeps it — they cover each other."* or *"Both of them want the ball to feet; nobody stretches this pairing in behind."* Phrase rules in `src/domain/squad/partnership-phrases.ts`, deterministic like the summary line.

### 8.4 Best partners for a player

`bestPartners(candidate, targetSlot, referenceSquad)` → for each slot linked to `targetSlot`, take the incumbent (and up to one backup) and compute the partnership score; return them ranked, each with its read. This is what the Dossier shows under "Who he plays well next to" and what powers the chemistry read in the fit panel (doc 08 §9). A pairing that scores `< 45` is surfaced as a **warning**, not hidden — telling a user a signing unbalances his midfield is as valuable as telling him it works.

### 8.5 Squad chemistry snapshot

For the current XI, evaluate every link and render the tactics-board (doc 09) with the **links drawn as lines** whose weight/colour reflect partnership strength (ink for strong, faint for weak, red for a `< 45` warning link). This turns "does my team fit together" into one glance. Weak links become gap cards of kind `chemistry` that hand off to Scout pre-filtered for the capability the pair is missing.

## 9. Acceptance examples

- Squad of 25 with 3 natural CBs where the 3rd has pairScore 48 → CB slot `thin`, gap card `depth/CB/medium`.
- Gegenpress preset + squad with one Press Machine ≥ 70 → gap card `dna/pressMachine severity high` and Scout handoff pre-filtered to `archetype pressMachine ≥ 70, position any midfield/forward`.
- Re-upload next season: a 17-year-old's acceleration 12→14 shows +2 and he appears in "Top risers".
- Pivot of two players both from the **Progressor** family → redundancy penalty applied, partnership flagged `< 45` with read "both want the ball to feet; nobody wins it back", and a `chemistry` gap card pre-filtering Scout for `P(defActivity) ≥ 60` ball-winners.
- A Destroyer + a Deep Progressor in the same pivot, both natural, covering all four pivot capabilities → partnership ≥ 80 with read "he wins it back, your playmaker keeps it".

