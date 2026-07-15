# 06 — Archetype System

The flagship feature. Roles (doc 05) answer *"can this player execute role X in my tactic?"*. Archetypes answer the prior question: *"what kind of footballer is this?"* — independent of any tactic, and largely independent of position labels.

## 1. Design principles

1. **Percentile-based, not absolute.** Archetypes are computed from attribute/derived-metric **percentiles within the dataset** (doc 04 §4). A "Press Machine" in League Two is real even though his raw Work Rate is 13 — he's 95th percentile *in that world*. This is what makes the feature magic across all save types.
2. **Gates + weights.** Each archetype has *gates* (hard percentile or raw-value requirements — fail any gate and the score is capped at 40, rendered as "partial fit") and a *weighted profile* that produces the 0–100 score.
3. **Multi-label.** A player has scores for **all** archetypes. UI shows the top 3 as the player's identity ("Deep Progressor 87 · Tempo Dictator 74 · Press Resister 71"). There is no forced single class.
4. **Position families limit noise.** Each archetype declares which position groups (doc 04 §4) it applies to. Scores outside the family are computed (retraining scenarios) but sit behind the same "ignore position" toggle as roles.

## 2. Scoring formula

```
P(x)        = percentile (0–100) of attribute/derived metric x within the player's dataset,
              computed on the whole outfield population (not position cohort) —
              archetypes compare footballers to footballers
base        = Σ (w_i × P(x_i)) / Σ w_i                    // weights from the table
gatePenalty = 0 if all gates pass; else cap score at 40
score       = min(base, gateCap)
```

Weights use the same ×3/×2/×1 tier system as roles. Gates are expressed as `P(x) ≥ N` (percentile gate) or `mid(x) ≥ v` (raw gate — used where an absolute floor matters regardless of world, e.g. you cannot be a Roadrunner with Pace 9 even in League Two: raw gates encode physics, percentile gates encode "elite within this world").

GK archetypes use the GK population for percentiles.

## 3. Archetype registry (canonical, v1 — 36 archetypes)

Format: **Gates** → hard requirements; **Core ×3 / Major ×2 / Minor ×1** → profile. `d:` prefix = derived metric from doc 04 §4; bare IDs = raw attributes.

### Build-up & creation family (groups: DM/CM, AM/W, FB/WB, CB)

| Archetype | Gates | Core ×3 | Major ×2 | Minor ×1 |
|---|---|---|---|---|
| **Deep Progressor** — moves the ball from deep zones through lines | P(passing) ≥ 70, P(composure) ≥ 55 | passing, vision, d:pressResist | firstTouch, technique, decisions | dribbling, anticipation |
| **Tempo Dictator** — controls rhythm, always available, never rushed | P(decisions) ≥ 65, P(composure) ≥ 65 | decisions, composure, passing, teamwork | vision, firstTouch, concentration | positioning, technique |
| **Chance Architect** — the final ball | P(d:creativity) ≥ 75 | vision, passing, flair | technique, firstTouch, offTheBall | dribbling, composure |
| **Press Resister** — receives under pressure and escapes | P(d:pressResist) ≥ 75 | firstTouch, composure, agility, balance | dribbling, technique, decisions | strength, vision |
| **Wide Creator** — creates from flank zones | P(crossing) ≥ 65, P(d:creativity) ≥ 55 | crossing, passing, technique | vision, dribbling, firstTouch | flair, agility |
| **Dead-Ball Specialist** — a set-piece weapon | P(technique) ≥ 55, mid(freeKicks) ≥ 12 | freeKicks, corners, technique | penalties, passing, composure | longShots, crossing, vision |
| **Link Forward** — a striker who plays as the team's connector | P(passing) ≥ 60, P(firstTouch) ≥ 60 | passing, firstTouch, composure, teamwork | vision, technique, offTheBall, decisions | dribbling, flair |

### Ball-carrying & speed family (groups: AM/W, FB/WB, DM/CM, ST)

| Archetype | Gates | Core ×3 | Major ×2 | Minor ×1 |
|---|---|---|---|---|
| **Line Breaker** — carries the ball past opponents | P(dribbling) ≥ 75, mid(acceleration) ≥ 11 | dribbling, d:mobility, technique | flair, firstTouch, pace | composure, offTheBall |
| **Roadrunner** — pure vertical speed threat | mid(pace) ≥ 14, P(d:speed) ≥ 80 | pace, acceleration | offTheBall, dribbling, stamina | agility, flair |
| **Transition Weapon** — devastating in the first 5 seconds after turnover | P(d:speed) ≥ 70, P(offTheBall) ≥ 55 | acceleration, offTheBall, dribbling | pace, firstTouch, composure, anticipation | finishing, flair |
| **Touchline Isolator** — beats his man one-on-one out wide | P(dribbling) ≥ 80, mid(agility) ≥ 12 | dribbling, agility, flair, acceleration | balance, technique, pace | offTheBall, composure |
| **Runner in Behind** — times runs off the last shoulder | P(offTheBall) ≥ 70, P(d:speed) ≥ 70 | offTheBall, acceleration, pace, anticipation | finishing, composure | firstTouch, agility |
| **Overlapping Outlet** — an athletic wide runner from deep | P(d:speed) ≥ 70, P(d:workEngine) ≥ 60 | pace, stamina, crossing, workRate | acceleration, offTheBall, dribbling | teamwork, positioning |

### Goal threat family (groups: ST, AM/W)

| Archetype | Gates | Core ×3 | Major ×2 | Minor ×1 |
|---|---|---|---|---|
| **Penalty-Box Predator** — lives on the last touch | P(finishing) ≥ 75, P(offTheBall) ≥ 65 | finishing, offTheBall, anticipation, composure | firstTouch, concentration | acceleration, agility, heading |
| **Aerial Monster** — dominant in both boxes in the air | P(d:aerial) ≥ 85, mid(jumpingReach) ≥ 13 | jumpingReach, heading, strength | bravery, anticipation, balance | offTheBall, aggression |
| **Complete Finisher** — scores every type of goal | P(finishing) ≥ 70, P(d:mobility) ≥ 50, P(d:aerial) ≥ 50 | finishing, offTheBall, composure | heading, dribbling, technique, anticipation | pace, longShots, firstTouch |
| **Second-Phase Threat** — arrives late, long shots, chaos in the box | P(longShots) ≥ 65, P(offTheBall) ≥ 55 | longShots, offTheBall, anticipation | finishing, workRate, stamina | composure, technique |
| **Target Fulcrum** — hold-up hub who brings others into play | P(d:physicality) ≥ 70, P(firstTouch) ≥ 50 | strength, heading, firstTouch, balance | jumpingReach, passing, composure, bravery | teamwork, offTheBall, finishing |
| **Long-Range Marksman** — a threat from distance | P(longShots) ≥ 80 | longShots, technique, composure | finishing, flair, vision | firstTouch, offTheBall |
| **Cutting-Inside Finisher** — a wide man who scores by coming inside | P(finishing) ≥ 70, P(dribbling) ≥ 65 | finishing, dribbling, offTheBall, acceleration | composure, technique, agility | longShots, flair, pace |

### Defensive work family (groups: CB, FB/WB, DM/CM, AM/W, ST)

| Archetype | Gates | Core ×3 | Major ×2 | Minor ×1 |
|---|---|---|---|---|
| **Press Machine** — hunts the ball for 90 minutes | P(d:workEngine) ≥ 80, P(aggression) ≥ 55 | workRate, stamina, aggression, anticipation | acceleration, tackling, bravery, teamwork | determination, pace |
| **Duel Winner** — wins individual battles, ground and air | P(tackling) ≥ 70, P(d:physicality) ≥ 60 | tackling, strength, aggression, bravery | heading, jumpingReach, anticipation | marking, balance, determination |
| **Reader of the Game** — intercepts, positions, never dives in | P(d:defPosition) ≥ 75, P(anticipation) ≥ 70 | anticipation, positioning, concentration, decisions | marking, composure | tackling, teamwork |
| **Recovery Sprinter** — defends space behind with pace | P(d:speed) ≥ 75 within CB+FB/WB population, P(d:defPosition) ≥ 50 | pace, acceleration, anticipation | positioning, tackling, concentration, agility | marking, bravery |
| **Destroyer** — breaks up play by force in midfield zones | P(tackling) ≥ 75, P(aggression) ≥ 65 | tackling, aggression, workRate | anticipation, strength, bravery, stamina | positioning, determination |
| **Man-Marker** — locks onto and smothers a danger man | P(marking) ≥ 75, P(concentration) ≥ 60 | marking, concentration, tackling, anticipation | positioning, aggression, strength, pace | bravery, determination |
| **Anchor** — a positional shield that never leaves its post | P(d:defPosition) ≥ 70, P(teamwork) ≥ 55 | positioning, concentration, tackling, teamwork | anticipation, decisions, marking, composure | strength, workRate |

### Engine & intangibles family (all outfield groups)

| Archetype | Gates | Core ×3 | Major ×2 | Minor ×1 |
|---|---|---|---|---|
| **Perpetual Motion** — physical outlier engine | P(d:workEngine) ≥ 85, P(naturalFitness) ≥ 60 | stamina, workRate, naturalFitness | acceleration, pace, strength | agility, determination |
| **Leader-Organizer** — the dressing-room and on-pitch general | P(leadership) ≥ 80, P(determination) ≥ 60 | leadership, determination, teamwork | bravery, composure, decisions, concentration | workRate, aggression |
| **Maverick** — high flair, high variance, makes something from nothing | P(flair) ≥ 85, P(technique) ≥ 65 | flair, technique, dribbling | vision, firstTouch, agility | longShots, composure |
| **Athletic Specimen** — a physical outlier in every direction | P(d:speed) ≥ 70, P(d:physicality) ≥ 70 | acceleration, pace, strength, jumpingReach | stamina, balance, agility, naturalFitness | bravery, workRate |
| **Warrior** — a brave, aggressive tone-setter | P(bravery) ≥ 70, P(aggression) ≥ 60 | bravery, aggression, determination, workRate | tackling, strength, teamwork | leadership, stamina |

### Goalkeeper family (group GK; percentiles over GK population)

| Archetype | Gates | Core ×3 | Major ×2 | Minor ×1 |
|---|---|---|---|---|
| **Shot-Stopping Wall** | P(reflexes) ≥ 75 | reflexes, handling, oneOnOnes, positioning | concentration, agility, composure | aerialReach, bravery |
| **Modern Distributor** — 11th outfielder | P(kicking) ≥ 65, P(composure) ≥ 60 | passing, kicking, firstTouch, composure | vision, decisions, throwing | reflexes, handling |
| **Box Commander** — owns the penalty area | P(commandOfArea) ≥ 70, P(d:aerial GK: aerialReach) ≥ 65 | commandOfArea, aerialReach, communication | punching, handling, bravery, jumpingReach | leadership, concentration |
| **Sweeper-Keeper** — defends the space behind the line | P(rushingOut) ≥ 65, P(acceleration) ≥ 55 | rushingOut, oneOnOnes, acceleration, anticipation | positioning, composure, reflexes | pace, agility, kicking |

(For Box Commander the aerial gate uses `P(aerialReach)`; GK archetypes never use outfield derived metrics.)

## 4. Presentation semantics

- **Primary identity** = top archetype with score ≥ 60 and all gates passed. If none qualifies, identity = "Unremarkable profile" with the top partial fits listed — honesty is a feature; most players in a 20k database *are* unremarkable.
- **Badges**: score ≥ 85 → "Elite", 70–84 → "Strong", 60–69 → "Notable". Below 60 not shown as identity.
- Every archetype card expands into a contribution breakdown: each attribute's percentile, weight, and points contributed (doc 01, principle 4).
- Archetype scores always display next to the **confidence** value; heavy masking (confidence < 0.5) renders the badge outlined instead of filled with tooltip "needs scouting".

## 5. Archetype DNA of a squad

Squad-level aggregation (consumed by doc 07): for each archetype, the count of squad players with score ≥ 70. Rendered as the **Squad DNA fingerprint** — this makes gaps obvious ("zero Press Machines in a gegenpress save").

## 6. Interaction with roles

Roles and archetypes are computed independently, but the player page cross-references them: for each of the player's top-3 archetypes we show the 3 highest-scoring roles that *share ≥ 2 core attributes* with that archetype ("As a Deep Progressor he fits: Deep-Lying Playmaker, Advanced CB, Inverted Full-Back"). The mapping is derived at build time from the two registries — never hand-maintained.

## 7. Golden fixtures & validation

`/tests/fixtures/golden-players.json` (shared with doc 05) must include per-archetype anchors — for each archetype at least one player expected to score ≥ 80 and one expected ≤ 45 (e.g. a Rodri-alike: Tempo Dictator ≥ 80, Roadrunner ≤ 45; a Haaland-alike: Penalty-Box Predator and Transition Weapon ≥ 80, Chance Architect ≤ 55). Tests assert these inequalities, not exact values, so weights can be tuned freely.

Sanity property tests (run on the large fixture dataset):

1. Score distribution per archetype is not degenerate (p95 − p5 ≥ 25 points).
2. < 15% of outfield players have any archetype ≥ 85 (Elite must be rare).
3. Gate failures cap correctly (no gated player above 40 on that archetype).
4. Percentile invariance: multiplying the dataset by duplicating every player leaves all scores unchanged.

## 8. Worked example (canonical unit test)

Dataset percentiles for a player: passing 92, vision 84, pressResist 78, firstTouch 80, technique 75, decisions 70, dribbling 55, anticipation 60, composure 88.

**Deep Progressor**: gates `P(passing)=92 ≥ 70` ✓, `P(composure)=88 ≥ 55` ✓.
Core ×3: passing 92, vision 84, pressResist 78 → 3×254 = 762.
Major ×2: firstTouch 80, technique 75, decisions 70 → 2×225 = 450.
Minor ×1: dribbling 55, anticipation 60 → 115.
`base = (762+450+115) / (9+6+2) = 1327 / 17 = 78.06` → **score 78, badge "Strong"**.

Commit as the first archetype-engine test.

## 9. General archetype (the coarse family)

The **36** fine archetypes are precise but too many to lead with. Above them sits a small set of **general archetypes** — the one-word answer to "what is he, broadly?" This is what the UI shows as the eyebrow above a player's name and what the Ledger groups by. Every fine archetype belongs to exactly one family.

| General archetype | Reads as | Fine archetypes in it |
|---|---|---|
| **Progressor** | keeps and advances the ball | Deep Progressor, Tempo Dictator, Press Resister |
| **Creator** | makes chances for others | Chance Architect, Wide Creator, Maverick, Dead-Ball Specialist, Link Forward |
| **Carrier** | beats men with the ball at his feet | Line Breaker, Touchline Isolator |
| **Runner** | threatens space with pace | Roadrunner, Transition Weapon, Runner in Behind, Overlapping Outlet |
| **Engine** | covers ground and presses for 90 | Perpetual Motion, Press Machine, Athletic Specimen |
| **Destroyer** | wins the ball back and defends | Duel Winner, Destroyer, Reader of the Game, Recovery Sprinter, Man-Marker, Anchor |
| **Finisher** | puts the ball in the net | Penalty-Box Predator, Complete Finisher, Second-Phase Threat, Long-Range Marksman, Cutting-Inside Finisher |
| **Focal Point** | the target the team plays through | Target Fulcrum, Aerial Monster |
| **General** | leads and organises | Leader-Organizer, Warrior |
| **Shot-Stopper** (GK) | keeps the ball out | Shot-Stopping Wall |
| **Distributor** (GK) | starts play, sweeps | Modern Distributor |
| **Commander** (GK) | owns the box | Box Commander |
| **Sweeper** (GK) | defends the space behind the line | Sweeper-Keeper |

The `family` is a field on every archetype in the registry (`src/domain/archetypes/registry.ts`); the table above is the single source and must not be duplicated in UI code.

**A player's general archetype** = the family of his **primary** archetype (the top scorer that passes its gates and reaches ≥ 60). Rules:

- If the top two archetypes come from **different families** and are within 6 points of each other, present a **hybrid**: "Progressor–Creator" (primary family first). This is common and honest — many good players are two things.
- If **no** archetype reaches 60, the general archetype is **Utility** and the summary says so plainly (see §10). Do not invent a flattering family for an average player.
- Goalkeepers only ever receive GK families.

The general archetype drives: the eyebrow line on the Dossier, the grouping option in the Ledger, the axis of the Squad DNA (doc 07 rolls fine archetypes up to families for its headline view, and drills into fine ones on demand).

## 10. Human summary line (the signature)

Every player gets one sentence of plain English that a scout might say out loud. It is generated **deterministically** — no LLM, no randomness — from the player's scores, so it is fast, free, offline, and unit-testable. It renders in serif italic under the name (doc 09, `SummaryLine`).

### Shape

> *A {age} {family noun} who {primary behaviour}. {standout}, {caveat}.*

with an optional trailing scouting hedge when confidence is low.

### Inputs and phrase banks

All phrase banks live in `src/domain/archetypes/phrases.ts`. They are editorial content, versioned with the engine.

- **age word** — `< 20` → "teenage"; `20–23` → "young"; `24–29` → "" (omit); `30–32` → "experienced"; `≥ 33` → "veteran".
- **family noun** — one noun phrase per general archetype, position-aware where it helps: Progressor → "ball-progressing midfielder" (or "ball-playing defender" if position group is CB), Creator → "creator", Carrier → "ball-carrier", Runner → "runner", Engine → "midfield engine" (or "runner" for wide/forward), Destroyer → "ball-winner", Finisher → "finisher", Focal Point → "focal point", General → "leader", GK families → "shot-stopper" / "ball-playing keeper" / "commanding keeper". Utility → "squad player".
- **primary behaviour** — one clause per **fine** archetype, e.g. Deep Progressor → "breaks lines from the base of midfield", Penalty-Box Predator → "lives on the last touch in the box", Press Machine → "hunts the ball down for the full ninety". Hybrids join two clauses with "and also".
- **standout** — take the player's single highest **percentile** among his derived metrics and the top-weighted attributes of his primary archetype. Map to a framed phrase by band: `P ≥ 90` → a counted claim ("one of the best {passers/finishers/…} in this division"); `75 ≤ P < 90` → "well above this level for {trait}"; below 75 → skip the standout entirely (an average player has no standout, and the sentence should admit it).
- **caveat** — take the lowest notable percentile. Priority order: a hard physical hole first (`P(aerial) < 20` → "offers nothing in the air"; `P(speed) < 20` → "will be caught for pace"), otherwise the weakest contributing metric of the primary archetype. If nothing is notably weak (`min relevant P ≥ 45`), drop the caveat and close on a neutral note (preferred foot / versatility). Never manufacture a flaw.
- **confidence hedge** — if `confidence < 0.5`, append: " — though there aren't enough eyes on him yet to be sure." For Utility players the whole line is blunt: *"A squad player; nothing here stands out against this division."*

### Determinism rules

Highest/lowest selections use strict percentile comparison with ties broken by the fixed attribute order in doc 04 §2, so the same player always yields the same sentence. Counted claims ("one of the four best…") derive the count from the dataset (players at ≥ the player's percentile in that metric) and only render when that count ≤ 5; otherwise fall back to the "one of the best" phrasing without a number.

### Worked example (canonical unit test)

For the §8 example player (primary Deep Progressor 78 → family Progressor; age 21; passing P92 is his top metric and only 4 midfielders rank above him in passing; aerial P30, his lowest notable but not < 20; press-resistance solid):

> *"A young ball-progressing midfielder who breaks lines from the base of midfield. One of the four best passers in this division, though he offers little in the air."*

(v1 shape: one standout clause + one caveat clause. A secondary strength clause is a post-v1 enhancement.)

Commit the exact string as the first summary-line test; changing the phrase bank bumps `engineVersion` and updates the snapshot deliberately.
