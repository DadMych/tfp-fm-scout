# 08 — Scouting Tools

The Scout screen operates on any dataset (most powerful with full-database exports). All queries hit the server API (`GET /api/datasets/:id/players?…` with Zod-validated query params), which pre-filters in Postgres and returns ≤ 2,000 rows for client-side interactive refinement (doc 04 §5).

## 1. Player table

- Virtualized table (TanStack Table + Virtual), default columns: Name, Age, Club, Division, Position, Top Archetype (badge + score), Best Role, Value, Wage, Expires, Confidence.
- Column picker with grouped attribute columns (Technical/Mental/Physical/GK, honoring the Set Pieces display group); chosen layout persists per user.
- Sort by any column; ranged attributes sort by midpoint; masked sort last.
- Row click → player drawer (quick view) → full player page.

## 2. Filter system

Composable filter bar; every filter chip = one predicate; chips AND together. Filter state serializes into the URL (shareable searches).

| Filter | Semantics |
|---|---|
| Position | any-of canonical slots, with "include retrainable" toggle (drops position gating, doc 05 §1) |
| Age | min/max |
| Archetype | `score(archetypeId) ≥ N`, multiple allowed |
| Role | `score(roleId) ≥ N`; also role-pair with combined threshold |
| Attribute | `mid(attr) ≥ N` (or ≤ for e.g. age-adjacent scouting); supports "known only" (exclude masked) |
| Derived | `P(derivedId) ≥ N` percentile |
| Value | max transfer value (dataset currency); "exclude Not for Sale" |
| Wage | max weekly wage |
| Contract | expires before date (free-transfer hunting) |
| Foot | preferred foot / minimum weak-foot strength |
| Nationality / Division / Club | text multi-select from dataset vocabulary |
| Confidence | minimum scouting confidence |

**Saved filters:** named per user, e.g. "cheap gegenpress FBs". Ship 6 curated presets: *Wonderkid radar* (age ≤ 19 ∧ any archetype ≥ 65), *Free-agent gems* (contract expired/expiring ∧ best role ≥ 65), *Bargain bin* (value ≤ dataset p25 ∧ any archetype ≥ 70), *Press army*, *Ball magnets*, *Speed merchants*.

## 3. Upgrade Finder

Input: one of my players + a slot context (IP+OOP pair). Output: dataset players who dominate him:

```
candidates = players where pairScore ≥ mine + 5
ranked by (pairScoreDelta × affordabilityFactor)
affordabilityFactor = 1 if value/wage unknown; scales down candidates above user-set budget caps
```

Each result card: pairScore delta, age delta, value, the 3 attributes with the biggest advantage, and the 1 biggest downgrade ("+8 pairScore, but you lose your best Aerial Monster"). One click → shortlist.

## 4. Similar-player search ("more like him")

Vector = percentiles of all derived metrics + the 10 attributes with the highest weight in the player's top archetype. Similarity = cosine over that vector, filtered to same position group by default. Use case: replacing a departing star with his stylistic twin, cheaper/younger. Top-20 list with similarity %, age, value.

Implementation note: brute-force cosine over ≤ 200k rows in the worker/API is fine (< 100 ms with typed arrays); no vector DB.

## 5. Compare view

2–4 players side by side:

- Radar chart over the 8 derived metrics (percentile space, so cross-division comparisons stay meaningful).
- Attribute table with per-row best-value highlighting; ranged values render as ranges.
- Archetype badge rows and role-pair scores for a chosen slot context.
- Shareable via dataset share link + player ids in URL.

## 6. Shortlists

- Multiple named shortlists per user; entries reference `playerIdentity` when a SaveSeries exists (survive re-imports), else the dataset player.
- Entry stores a **snapshot** of scores at add-time → the shortlist view shows deltas since added ("his Press Machine score rose 6 since you shortlisted him").
- Notes per entry (free text). Status per entry: `watching / bid target / rejected`.
- Export shortlist as CSV (name, club, age, value, top archetype, best role) — users paste this back into FM search.

## 7. Player page (the atom of the product)

Route: `/d/:dataset/players/:id`. Sections:

1. **Header**: name, age, club, positions (pitch mini-map of playable slots), value/wage/contract, confidence meter.
2. **Identity strip**: top-3 archetype badges with scores; click → contribution breakdown (doc 06 §4).
3. **Radar**: 8 derived metrics vs position-group percentile; toggle to raw 1–20 view.
4. **Attribute grid**: FM26 layout (Technical / Mental / Physical / Set Pieces / GK), color scale on dataset percentile not raw value, masked cells shown as `?`, ranged as `10–14` with band styling.
5. **Role matrix**: all applicable IP roles × OOP roles heat-mapped by pairScore for the player's position slots.
6. **Suggested roles per archetype** (doc 06 §6).
7. **General archetype eyebrow + human summary line** (doc 06 §9–§10) sit at the top of the header, above the name — the first thing read.
8. **"Where he fits your side"** (§9 below) — shown only when a reference squad is set.
9. **Actions**: add to shortlist, compare, find similar, find upgrades-over.
10. **History tab** (SaveSeries only): attribute deltas across datasets.

## 9. "Where he fits your side" (fit to the reference squad)

The question every scout actually has is not "is he good?" but "is he good **for us**?" When a reference squad is set (doc 07 §7), this section answers it, in prose and figures. It is a pure function of `(candidate, referenceSquad)` in `src/domain/squad/fit.ts`, so it is testable and identical on the Dossier, the fit drawer, and the Front Page brief.

### 9.1 Best slot & fit verdict

Compute the candidate's `pairScore` for every slot in the reference tactic (using each slot's IP+OOP pair). His **best slot** is the highest. Compare it to that slot's incumbent (`slotIncumbents[slot]`, doc 07 §7):

- delta ≥ +8 → verdict **"Upgrade"** ("straight into your XI at {slot}, ahead of {incumbent}");
- −3…+8 → **"Rotation"** ("even with {incumbent} — squad depth, not a starter");
- < −3 but he is natural and young → **"Project"** ("not ready to displace {incumbent}, but he's {age}");
- otherwise → **"Not for you"** ("doesn't improve any position in your side"). We say this plainly rather than pretending everyone fits.

### 9.2 What he improves

A short written brief (one or two sentences, no bullet list) assembled deterministically from:

- **Slot upgrade** — the pairScore delta over the incumbent, framed ("+11 on your current left-back").
- **Gaps closed** — cross-reference `findGaps` (doc 07 §4): if the candidate satisfies a depth, DNA, succession, or chemistry gap, name it ("fills your standing need for a left-footed centre-back", "your first genuine Press Machine").
- **DNA shift** — how the squad's archetype fingerprint (doc 06 §5 / families) moves if he replaces the incumbent — only mentioned when it crosses a target threshold from the tactic profile.
- **Set-piece** — if signing him would make him the squad's best taker of anything (doc 07 §6).

If he improves nothing, the brief says so.

### 9.3 Who he plays well next to

Runs `bestPartners(candidate, bestSlot, referenceSquad)` (doc 07 §8.4) and shows the top two linked team-mates with their partnership score and one-line read, plus any `< 45` **warning** partnership ("but he'd leave your pivot without a ball-winner"). This is the chemistry answer, on the scouting screen, before you spend a penny.

### 9.4 Who he displaces

Names the incumbent(s) he beats and — if the displaced player is young/valuable — a one-line note that he becomes a sale or a squad rotation option. Closes the loop back to squad planning.

### 9.5 On the Ledger and in filters

When a reference squad is set, the Ledger gains a **Fit** column (the §9.1 verdict as a small stamp + best-slot pairScore) and two filters: **"improves my XI"** (verdict = Upgrade) and **"fits a gap"** (closes any current gap). Sorting by Fit turns the entire division into a ranked shopping list for *your* side — the single most valuable view in the product for the scouting persona.

## 10. Acceptance examples

- Filter `position DM ∧ archetype deepProgressor ≥ 70 ∧ age ≤ 23 ∧ value ≤ 10M` returns in < 500 ms p95 on a 20k dataset and the URL reproduces the exact result set on reload.
- Upgrade Finder on a 62-pairScore left-back with budget 15M never returns players below 67 pairScore or above budget (unless "show unaffordable" toggled).
- Adding a player to a shortlist, re-uploading next season's export into the series, and reopening the shortlist shows the same human with score deltas — not a duplicate entry.
- With a reference squad set, a striker whose best-slot pairScore is +11 over the incumbent shows verdict **Upgrade**, a "what he improves" brief naming the delta, and at least one partnership read with the linked winger; the same player with no reference squad shows none of this section.
- "Improves my XI" filter returns only players whose best-slot verdict is Upgrade, and the set matches sorting the full Ledger by Fit and taking the Upgrade stamps.
