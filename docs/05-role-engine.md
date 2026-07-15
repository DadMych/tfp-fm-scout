# 05 — Role Engine

Computes a 0–100 fit score for every FM26 role for every player. FM26 splits roles into **In Possession (IP)** and **Out of Possession (OOP)** phases — the FM24 duty system (Defend/Support/Attack) is gone and must not appear anywhere in code or UI.

## 1. Scoring formula

Each role defines weighted attributes in three tiers: **Core ×3**, **Major ×2**, **Minor ×1**.

```
raw(player, role)   = Σ (weight_i × midpoint_i)  over role attributes present
maxRaw(role)        = Σ (weight_i × 20)
score(player, role) = 100 × raw / maxRaw
```

- Masked attribute (`null`): excluded from both `raw` and `maxRaw` (score is over known attributes), and reduces `confidence` (doc 04 §4). If > 50% of a role's weight mass is masked, the score renders as "insufficient scouting".
- Ranged attributes use midpoints (doc 03 §6.1).
- **Position gating:** a role score is only *displayed by default* for players whose `positions` cover one of the role's slots; the engine still computes all roles (the scout screen has an "ignore position" toggle — finding retrainable players is a feature).
- Store per-player: full `Record<RoleId, {score, confidence}>` plus denormalized `best_role`.

A score of ~55 is "usable", 65+ "good", 75+ "excellent" for typical top-division datasets. The UI shows the score *and* its percentile within the dataset's position group; percentile is the primary visual (doc 09).

## 2. Role registry format

`src/domain/roles/registry.ts` — one entry per role:

```ts
interface RoleDef {
  id: RoleId;                // e.g. 'ip.channelMidfielder'
  name: string;              // 'Channel Midfielder'
  phase: 'IP' | 'OOP';
  slots: PositionSlot[];     // where FM offers this role
  core: AttributeId[];       // ×3
  major: AttributeId[];      // ×2
  minor: AttributeId[];      // ×1
}
```

## 3. Role tables (v1 weights)

Weights are our v1 editorial estimates informed by role descriptions and FM attribute logic; they are **expected to be tuned** via the calibration process in §5. Derived-metric shorthand is not used here — only raw attribute IDs, so the engine stays a single formula.

Legend: attributes listed as `Core | Major | Minor`.

### Goalkeepers (slot GK; IP and OOP variants share weights where the in-game split is nominal)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Goalkeeper (both) | reflexes, handling, positioning, concentration | commandOfArea, aerialReach, oneOnOnes, decisions | kicking, communication, agility |
| Line-Holding Keeper (OOP) | reflexes, positioning, handling | concentration, commandOfArea, aerialReach | kicking, communication |
| No-Nonsense Goalkeeper (IP) | reflexes, handling, aerialReach, commandOfArea | kicking, punching, bravery | strength, concentration |
| Sweeper Keeper (OOP) | rushingOut, oneOnOnes, acceleration, anticipation | reflexes, positioning, composure, decisions | kicking, agility, pace |
| Ball-Playing Goalkeeper (IP) | passing, firstTouch, composure, kicking | vision, decisions, reflexes, handling | throwing, anticipation |

### Centre-backs (slots D-C; Wide CB variants also WB-L/R side of a back three — gate on D-C)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Centre-Back (both) | marking, tackling, positioning, heading | strength, jumpingReach, anticipation, concentration | bravery, aggression, pace |
| No-Nonsense Centre-Back (IP) | heading, tackling, marking, bravery | strength, jumpingReach, aggression, positioning | concentration, determination |
| Covering CB (OOP) | positioning, anticipation, concentration, pace | acceleration, decisions, marking | composure, tackling |
| Stopping CB (OOP) | tackling, aggression, bravery, anticipation | positioning, strength, decisions | marking, acceleration |
| Ball-Playing CB (IP) | passing, composure, firstTouch, vision | technique, decisions, marking, tackling | dribbling, anticipation |
| Overlapping CB (IP) | pace, stamina, crossing, tackling | dribbling, workRate, positioning, marking | passing, offTheBall |
| Advanced CB (IP) | passing, composure, decisions, anticipation | firstTouch, tackling, positioning, vision | dribbling, workRate |
| Wide CB (both) | tackling, marking, pace, positioning | stamina, anticipation, strength | crossing, dribbling |
| Covering Wide CB (OOP) | positioning, anticipation, pace, concentration | marking, acceleration, decisions | tackling, composure |
| Stopping Wide CB (OOP) | tackling, aggression, acceleration, bravery | anticipation, positioning, strength | marking, decisions |

### Full-backs (slots D-L/D-R) & wing-backs (slots WB-L/WB-R)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Full-Back (both) | tackling, positioning, marking, workRate | crossing, stamina, anticipation, concentration | passing, pace, teamwork |
| Holding Full-Back (OOP) | positioning, marking, concentration, tackling | anticipation, decisions, strength | composure, teamwork |
| Inside Full-Back (IP) | positioning, passing, composure, marking | firstTouch, decisions, tackling, anticipation | vision, strength |
| Inverted Full-Back (IP) | passing, firstTouch, composure, decisions | positioning, vision, tackling, technique | dribbling, teamwork |
| Pressing Full-Back (OOP) | workRate, acceleration, aggression, tackling | stamina, anticipation, bravery, pace | positioning, determination |
| Wing-Back (both) | stamina, crossing, workRate, pace | dribbling, tackling, acceleration, offTheBall | passing, positioning, teamwork |
| Holding Wing-Back (OOP) | positioning, tackling, marking, stamina | concentration, anticipation, workRate | strength, decisions |
| Inside Wing-Back (IP) | passing, firstTouch, decisions, composure | positioning, vision, stamina | technique, teamwork |
| Inverted Wing-Back (IP) | passing, composure, decisions, firstTouch | vision, technique, positioning, stamina | dribbling, anticipation |
| Pressing Wing-Back (OOP) | workRate, stamina, acceleration, aggression | tackling, anticipation, pace, bravery | positioning, determination |
| Playmaking Wing-Back (IP) | passing, vision, crossing, technique | firstTouch, decisions, stamina, composure | dribbling, flair, workRate |
| Advanced Wing-Back (IP) | crossing, dribbling, pace, stamina | acceleration, offTheBall, technique, workRate | passing, flair, agility |

### Defensive midfielders (slot DM)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Defensive Midfielder (both) | tackling, positioning, anticipation, concentration | marking, workRate, decisions, strength | passing, teamwork, stamina |
| Dropping DM (OOP) | positioning, anticipation, marking, decisions | concentration, composure, heading, strength | tackling, jumpingReach |
| Screening DM (OOP) | positioning, anticipation, concentration, decisions | marking, tackling, composure | workRate, teamwork |
| Wide Covering DM (OOP) | positioning, stamina, anticipation, workRate | tackling, marking, acceleration, pace | concentration, teamwork |
| Half-Back (IP) | positioning, composure, passing, decisions | anticipation, firstTouch, marking, concentration | tackling, vision |
| Pressing DM (OOP) | workRate, aggression, tackling, anticipation | stamina, acceleration, bravery, positioning | strength, determination |
| Deep-Lying Playmaker (IP) | passing, vision, composure, firstTouch | technique, decisions, anticipation | positioning, teamwork, flair |

### Central midfielders (slot M-C)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Central Midfielder (both) | passing, decisions, workRate, teamwork | firstTouch, positioning, stamina, tackling | vision, anticipation, composure |
| Screening CM (OOP) | positioning, anticipation, concentration, decisions | marking, tackling, composure, teamwork | workRate, strength |
| Wide Covering CM (OOP) | stamina, positioning, workRate, anticipation | tackling, marking, pace, teamwork | acceleration, decisions |
| Box-to-Box Midfielder (both) | stamina, workRate, passing, offTheBall | tackling, dribbling, decisions, strength | finishing, longShots, anticipation |
| Box-to-Box Playmaker (IP) | passing, stamina, vision, dribbling | firstTouch, technique, workRate, decisions | flair, offTheBall, composure |
| Channel Midfielder (IP) | offTheBall, stamina, passing, dribbling | acceleration, decisions, firstTouch, workRate | finishing, vision, flair |
| Midfield Playmaker (IP) | passing, vision, firstTouch, composure | technique, decisions, anticipation, flair | dribbling, teamwork, agility |
| Pressing CM (OOP) | workRate, aggression, anticipation, stamina | tackling, acceleration, bravery, decisions | positioning, determination |

### Wide midfielders (slots M-L/M-R)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Wide Midfielder (both) | crossing, workRate, stamina, teamwork | passing, tackling, decisions, positioning | dribbling, firstTouch, concentration |
| Tracking Wide Midfielder (OOP) | workRate, positioning, stamina, tackling | marking, anticipation, teamwork, concentration | pace, decisions |
| Wide Central Midfielder (IP) | passing, firstTouch, decisions, stamina | vision, technique, positioning, workRate | dribbling, composure |
| Wide Outlet Midfielder (OOP) | pace, acceleration, offTheBall, dribbling | crossing, stamina, firstTouch | flair, composure |

### Attacking midfielders (slot AM-C)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Attacking Midfielder (both) | passing, vision, offTheBall, technique | firstTouch, decisions, flair, composure | dribbling, longShots, finishing |
| Tracking AM (OOP) | workRate, teamwork, positioning, stamina | anticipation, tackling, decisions | marking, concentration |
| Advanced Playmaker (IP) | passing, vision, firstTouch, technique | composure, decisions, flair, anticipation | dribbling, agility, offTheBall |
| Central Outlet AM (OOP) | offTheBall, acceleration, composure, firstTouch | pace, anticipation, dribbling | passing, flair |
| Splitting Outlet AM (OOP) | pace, acceleration, offTheBall, dribbling | firstTouch, composure, crossing | flair, finishing |
| Free Role (IP) | flair, vision, technique, dribbling | passing, firstTouch, composure, offTheBall | decisions, agility, finishing |

### Wingers (slots AM-L/AM-R; Inside Forward & Wide Forward also gate here)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Winger (both) | crossing, dribbling, pace, acceleration | technique, agility, offTheBall, stamina | firstTouch, flair, workRate |
| Half-Space Winger (IP) | dribbling, offTheBall, passing, agility | firstTouch, technique, vision, composure | finishing, flair, acceleration |
| Inside Winger (IP) | dribbling, acceleration, technique, offTheBall | finishing, longShots, agility, pace | passing, flair, composure |
| Inverting Outlet Winger (OOP) | pace, acceleration, dribbling, offTheBall | firstTouch, composure, finishing | flair, agility |
| Tracking Winger (OOP) | workRate, stamina, positioning, teamwork | tackling, marking, anticipation, pace | concentration, decisions |
| Wide Outlet Winger (OOP) | pace, acceleration, dribbling, crossing | offTheBall, stamina, firstTouch | flair, composure |
| Wide Playmaker (IP) | passing, vision, technique, firstTouch | composure, decisions, flair, dribbling | crossing, agility |
| Wide Forward (IP) | finishing, offTheBall, acceleration, dribbling | pace, composure, firstTouch, technique | crossing, agility, flair |
| Inside Forward (IP) | dribbling, finishing, acceleration, offTheBall | technique, agility, composure, pace | passing, flair, longShots |

### Strikers (slot ST-C)

| Role (phase) | Core | Major | Minor |
|---|---|---|---|
| Centre Forward (both) | finishing, offTheBall, composure, anticipation | firstTouch, heading, pace, technique | dribbling, strength, decisions |
| False Nine (IP) | passing, vision, firstTouch, technique | dribbling, composure, offTheBall, flair | decisions, agility, finishing |
| Deep-Lying Forward (IP) | firstTouch, passing, composure, strength | technique, vision, offTheBall, decisions | heading, finishing, teamwork |
| Half-Space Forward (IP) | offTheBall, finishing, dribbling, acceleration | composure, firstTouch, agility, technique | passing, flair, pace |
| Channel Forward (IP) | offTheBall, pace, stamina, workRate | acceleration, finishing, dribbling, strength | firstTouch, crossing, teamwork |
| Second Striker (IP) | offTheBall, finishing, composure, anticipation | firstTouch, passing, dribbling, decisions | flair, longShots, agility |
| Central Outlet CF (OOP) | offTheBall, pace, acceleration, anticipation | finishing, composure, firstTouch, strength | heading, dribbling |
| Splitting Outlet CF (OOP) | pace, acceleration, offTheBall, dribbling | firstTouch, composure, crossing, finishing | flair, agility |
| Tracking CF (OOP) | workRate, teamwork, stamina, anticipation | positioning, tackling, decisions, aggression | marking, determination |
| Target Forward (both) | heading, strength, jumpingReach, bravery | firstTouch, finishing, offTheBall, balance | composure, teamwork, aggression |
| Poacher (both) | finishing, offTheBall, anticipation, composure | acceleration, firstTouch, concentration | pace, agility, heading |

## 4. Role-pair fit (unique feature)

FM26 tactics assign each slot an **IP role + OOP role pair**. We expose:

```
pairScore(player, ipRole, oopRole) = 0.55 × score(ip) + 0.45 × score(oop)
```

with a **conflict penalty**: if the pair demands disjoint physical profiles (e.g. `oop.wideOutletWinger` needs pace but `ip.widePlaymaker` doesn't), no penalty — asymmetry is legitimate; the only penalty applied is a **stamina tax**: if both roles have `stamina` or `workRate` in Core and the player's `workEngine` (doc 04) < 12, subtract `(12 − workEngine) × 2` points. Keep this the only special case in v1.

The tactic screen (doc 07) lets the user pick IP+OOP per slot and ranks the squad per slot by `pairScore`.

## 5. Calibration & maintenance

Weights above are v1. The tuning loop:

1. **Golden fixtures** (`/tests/fixtures/golden-players.json`): ~40 well-known players from a fresh FM26 save with hand-asserted expectations, e.g. "Rodri-alike scores ≥ 80 on Screening DM (OOP) and DLP (IP); ≤ 55 on Wide Outlet Winger". Tests assert ordinal relationships, not exact numbers — weights can be tuned without breaking tests as long as the *rankings* hold.
2. Every weight change bumps `engineVersion` and triggers the rescore job (doc 02).
3. When SI patches roles or the community documents in-game weightings more precisely, update the registry — never hardcode weights outside it.

**Note for implementers:** the in-game FM26 OOP role list is not exhaustively documented publicly; the registry above covers all roles confirmed by SI and reliable community sources as of mid-2026. Structure the registry so adding a role = adding one entry; UI must render whatever the registry contains (no hardcoded role lists in components).

## 6. Worked example (canonical unit test)

Using the doc 04 §4 example player, role `ip.midfieldPlaymaker`:
Core (×3): passing 16, vision 15, firstTouch 14, composure 13 → 3×58 = 174.
Major (×2): technique — assume 14, decisions — assume 13, anticipation 13, flair 11 → 2×51 = 102.
Minor (×1): dribbling — assume 12, teamwork — assume 14, agility 14 → 40.
`raw = 316`; `maxRaw = 3×4×20 + 2×4×20 + 1×3×20 = 240+160+60 = 460`; `score = 100×316/460 = 68.7`.

Commit this as the first engine test.
