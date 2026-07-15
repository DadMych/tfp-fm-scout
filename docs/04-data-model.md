# 04 — Data Model

Canonical entities, the attribute registry, derived metrics, and the DB schema. `src/domain/attributes.ts` must be generated to match §2 exactly.

## 1. Entity overview

```
User ─┬─< Dataset ──< Player ──< PlayerScores (roles, archetypes, derived)
      │      │
      │      └─< ImportReport
      ├─< SaveSeries ──< Dataset (ordered by season label)
      │        └─< PlayerIdentity (cross-dataset player linkage)
      └─< Shortlist ──< ShortlistEntry ──> PlayerIdentity
```

- **Dataset** = one uploaded file, parsed. Immutable after import (re-scoring updates `PlayerScores` only).
- **SaveSeries** = optional grouping of datasets from the same FM save across seasons; enables deltas and persistent shortlists.
- **PlayerIdentity** = stable handle for "the same footballer" across a series (doc 03 §7).

## 2. Attribute registry (canonical)

Every attribute: canonical ID, display name, FM short code (column abbreviation), category. The synonym table in doc 03 §5 is generated from this list. Scale is always 1–20, stored as `{min, max}` (doc 03 §6.1).

### Technical (outfield) — category `technical`

| ID | Name | Code |
|---|---|---|
| `corners` | Corners | Cor |
| `crossing` | Crossing | Cro |
| `dribbling` | Dribbling | Dri |
| `finishing` | Finishing | Fin |
| `firstTouch` | First Touch | Fir |
| `freeKicks` | Free Kick Taking | Fre |
| `heading` | Heading | Hea |
| `longShots` | Long Shots | Lon |
| `longThrows` | Long Throws | L Th |
| `marking` | Marking | Mar |
| `passing` | Passing | Pas |
| `penalties` | Penalty Taking | Pen |
| `tackling` | Tackling | Tck |
| `technique` | Technique | Tec |

### Mental — category `mental`

| ID | Name | Code |
|---|---|---|
| `aggression` | Aggression | Agg |
| `anticipation` | Anticipation | Ant |
| `bravery` | Bravery | Bra |
| `composure` | Composure | Cmp |
| `concentration` | Concentration | Cnt |
| `decisions` | Decisions | Dec |
| `determination` | Determination | Det |
| `flair` | Flair | Fla |
| `leadership` | Leadership | Ldr |
| `offTheBall` | Off The Ball | OtB |
| `positioning` | Positioning | Pos |
| `teamwork` | Teamwork | Tea |
| `vision` | Vision | Vis |
| `workRate` | Work Rate | Wor |

### Physical — category `physical`

| ID | Name | Code |
|---|---|---|
| `acceleration` | Acceleration | Acc |
| `agility` | Agility | Agi |
| `balance` | Balance | Bal |
| `jumpingReach` | Jumping Reach | Jum |
| `naturalFitness` | Natural Fitness | Nat |
| `pace` | Pace | Pac |
| `stamina` | Stamina | Sta |
| `strength` | Strength | Str |

### Goalkeeping — category `goalkeeping` (null for outfielders)

| ID | Name | Code |
|---|---|---|
| `aerialReach` | Aerial Reach | Aer |
| `commandOfArea` | Command Of Area | Cmd |
| `communication` | Communication | Com |
| `eccentricity` | Eccentricity | Ecc |
| `handling` | Handling | Han |
| `kicking` | Kicking | Kic |
| `oneOnOnes` | One On Ones | 1v1 |
| `punching` | Punching (Tendency) | Pun |
| `reflexes` | Reflexes | Ref |
| `rushingOut` | Rushing Out (Tendency) | TRO |
| `throwing` | Throwing | Thr |

Notes: GK profiles also use `firstTouch`/`passing` (shared technical IDs) for distribution; FM26 groups Set Pieces (`corners`, `freeKicks`, `penalties`, `longThrows`) separately in its UI — we keep them in `technical` with a `setPiece: true` flag for display grouping only.

## 3. Core types (domain layer)

```ts
type AttrValue = { min: number; max: number } | null;   // midpoint = (min+max)/2

interface Player {
  id: string;                    // uuid, per dataset
  datasetId: string;
  identityId: string | null;     // linked across a SaveSeries
  name: string;
  age: number | null;
  nationality: string | null;    // raw text from export
  club: string | null;
  division: string | null;
  positions: PositionSlot[];     // e.g. ['D-R','D-C']; 'GK' | `${'D'|'WB'|'DM'|'M'|'AM'|'ST'}-${'L'|'C'|'R'}`
  preferredFoot: 'left'|'right'|'either'|null;
  leftFoot: FootStrength | null;  // 'veryWeak'..'veryStrong'
  rightFoot: FootStrength | null;
  heightCm: number | null;
  transferValue: MoneyRange | null;   // normalized, dataset currency
  wageWeekly: number | null;        // reserved — not in current export view / parser (docs 11 §0)
  contractExpires: string | null;     // ISO date; reserved — not in current export view / parser
  personality: string | null;
  attrs: Record<AttributeId, AttrValue>;
  flags: { positionUnknown?: boolean; notForSale?: boolean };
}

interface PlayerScores {
  playerId: string;
  engineVersion: string;
  roles: Record<RoleId, RoleScore>;          // doc 05
  archetypes: Record<ArchetypeId, ArchetypeScore>; // doc 06
  derived: DerivedMetrics;                    // §4 below
  confidence: number;  // 0..1, share of attribute mass that is exact (not ranged/masked)
}
```

## 4. Derived metrics (computed once per player at import)

These feed roles, archetypes, and the UI. All in `src/domain/derived.ts`, all unit-tested with the worked example below.

| ID | Formula (attribute midpoints) | Meaning |
|---|---|---|
| `speed` | `(acceleration + pace) / 2` | Raw speed |
| `workEngine` | `(workRate + stamina) / 2` | Ability to run all match |
| `aerial` | `(jumpingReach + heading) / 2` (+ `strength/4` bonus capped at 20) | Aerial threat |
| `pressResist` | `(firstTouch + composure + balance + agility) / 4` | Plays out of pressure |
| `creativity` | `(vision + passing + flair) / 3` | Chance creation base |
| `defActivity` | `(tackling + aggression + anticipation) / 3` | Front-foot defending |
| `defPosition` | `(positioning + marking + concentration) / 3` | Positional defending |
| `finishingPkg` | `(finishing + composure + offTheBall) / 3` | Goalscoring package |
| `mobility` | `(agility + balance + acceleration) / 3` | Tight-space movement |
| `physicality` | `(strength + jumpingReach + stamina + balance) / 4` | Physical presence |

**Percentiles:** for each derived metric and each raw attribute, compute the player's percentile **within the dataset**, and additionally within `positionGroup` cohorts (`GK`, `CB`, `FB/WB`, `DM/CM`, `AM/W`, `ST` — mapping from `positions` in `src/domain/position-groups.ts`; a player belongs to every group his positions cover). Percentile = fraction of cohort strictly below + half of ties (standard mid-rank), stored as 0–100.

**Confidence:** `confidence = Σ weight of exact attrs / Σ weight of all attrs used by a given score`. Scores with confidence < 0.5 render with an "insufficient scouting" treatment (doc 09).

### Worked example (canonical unit test)

Player midpoints: acceleration 15, pace 13, workRate 16, stamina 17, jumpingReach 8, heading 9, strength 12, firstTouch 14, composure 13, balance 12, agility 14, vision 15, passing 16, flair 11, tackling 7, aggression 9, anticipation 13, positioning 8, marking 6, concentration 12, finishing 10, offTheBall 12.

Expected: `speed = 14`, `workEngine = 16.5`, `aerial = 8.5 + 3 = 11.5`, `pressResist = 13.25`, `creativity = 14`, `defActivity = 9.67 (2dp)`, `defPosition = 8.67 (2dp)`, `finishingPkg ≈ 11.67`, `mobility ≈ 13.67`, `physicality = 12.25`.

## 5. Database schema (Drizzle/Postgres, abbreviated)

```
users(id, email, name, created_at)
save_series(id, user_id, name, created_at)
datasets(id, user_id, series_id NULL, name, season_label NULL, status ENUM(queued|parsing|scoring|ready|failed),
         raw_file_key, detected_format, currency, engine_version, parser_version,
         row_count, created_at)
import_reports(dataset_id PK/FK, report JSONB)
player_identities(id, series_id, name, nationality, first_seen_dataset_id)
players(id, dataset_id, identity_id NULL,
        name, age, nationality, club, division,
        positions TEXT[],                 -- canonical slot strings
        preferred_foot, left_foot, right_foot, height_cm,
        transfer_value_min, transfer_value_max, wage_weekly, contract_expires,
        personality, flags JSONB,
        attrs JSONB,                      -- Record<AttributeId, {min,max}|null>
        search_name TEXT)                 -- unaccented lowercase, for ILIKE/trigram search
player_scores(player_id PK/FK, engine_version,
        roles JSONB, archetypes JSONB, derived JSONB, confidence REAL,
        top_archetype TEXT, top_archetype_score REAL,   -- denormalized for fast lists
        best_role TEXT, best_role_score REAL)
shortlists(id, user_id, series_id NULL, name, created_at)
shortlist_entries(id, shortlist_id, identity_id NULL, player_id, note TEXT, added_at,
                  snapshot JSONB)         -- frozen scores at add time, for delta views
```

Indexes: `players(dataset_id)`, GIN on `players(positions)`, trigram on `search_name`, `players(dataset_id, age)`, expression indexes on hot JSONB paths used by the scout filters (`(attrs->'pace'->>'min')::int` etc. — the exact set is decided by the filter spec in doc 08 §2; add them in the same migration as the filter API).

Filtering strategy for v1: scout-screen queries hit Postgres with WHERE clauses over the denormalized columns + JSONB paths; the loaded dataset view (≤ ~2k rows after server pre-filter) is then filtered/sorted instantly client-side in TanStack Table. Revisit materializing attributes into columns only if p95 filter latency > 500 ms on a 200k-row account.

## 6. Public share model

`dataset_shares(dataset_id, public_slug UNIQUE, created_at, revoked_at NULL)` — read-only route `/d/:publicSlug` resolves through this table only; never expose internal ids in shared UI.
