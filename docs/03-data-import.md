# 03 — Data Import

How player data gets out of FM26 and into TFP FM. This is the most failure-prone part of the product; treat every rule here as a contract.

## 1. How export works in FM26 (context for implementers)

FM26 **removed** the native `Ctrl+P` "print to file" export that older FMs had. The community fixed this with **FM26 Player Export by vinteset** — a free BepInEx 6 plugin (distributed via FM Scout / sortitoutsi). What it does:

- Works on two in-game screens: **Squad** and **Player Search / Database**.
- On hotkey (**F9**, legacy `Ctrl+P`), it auto-scrolls the visible list and captures **every column currently visible in the active view** for **all rows** (not just on-screen ones).
- Writes two files to `Documents\Sports Interactive\Football Manager 26\FM26PlayerExport by vinteset\`:
  - a **CSV** file, and
  - an **HTML** file in the classic FM "web page" format (single `<table>`, header row of column names, one `<tr>` per player).

Consequences for us:

- **Columns = whatever view the user had.** We must (a) ship a recommended view preset, and (b) gracefully handle arbitrary column subsets.
- Attribute values reflect **scouting knowledge**: fully known (`14`), ranged (`10-14`), or masked (`-`). This is by design (no-cheating principle, doc 01).
- Both CSV and HTML must be accepted — users will grab either file.

## 2. The TFP view preset (what we tell users to set up)

We ship a downloadable FM26 view file plus an illustrated guide (onboarding screen + `/help/export`). The view contains, in order:

1. **Identity:** Name, Age, Nat (nationality), Club, Division, Position, Preferred Foot, Height, Left Foot, Right Foot
2. **Contract/value:** Transfer Value, Wage, Expires, Personality, Media Handling (last two optional)

   > **Parser note (July 2026):** only **Transfer Value** is parsed in the current MVP. Wage and Expires are reserved fields (doc 04) — the assistant must not reference them until the export view and parser ship those columns (docs 11 §0, 13 §0).

3. **Technical (14):** Corners, Crossing, Dribbling, Finishing, First Touch, Free Kick Taking, Heading, Long Shots, Long Throws, Marking, Passing, Penalty Taking, Tackling, Technique
4. **Mental (14):** Aggression, Anticipation, Bravery, Composure, Concentration, Decisions, Determination, Flair, Leadership, Off The Ball, Positioning, Teamwork, Vision, Work Rate
5. **Physical (8):** Acceleration, Agility, Balance, Jumping Reach, Natural Fitness, Pace, Stamina, Strength
6. **Goalkeeping (13, `-` for outfielders):** Aerial Reach, Command Of Area, Communication, Eccentricity, First Touch (GK shares some), Handling, Kicking, One On Ones, Passing, Punching (Tendency), Reflexes, Rushing Out (Tendency), Throwing

User flow we document: *Squad or Player Search screen → load our view → press F9 → hands off the mouse until scrolling stops → upload the newest file from the export folder.*

## 3. Ingest requirements

- Accept `.html` and `.csv`, up to **80 MB**.
- Encoding: UTF-8 primary; fall back to Windows-1252 if UTF-8 decoding produces replacement characters (legacy FM exports were often Win-1252). Detect via BOM, then heuristic.
- Full-database exports reach **tens of thousands of rows**; parse streaming (doc 02).
- **Never silently drop a row.** Every skipped/partial row goes into the import report with row number and reason.

## 4. Format detection

1. Sniff first 4 KB (after decode).
2. Contains `<table` (case-insensitive) → **HTML path**.
3. Else → **CSV path**: detect delimiter by counting `,` vs `;` vs `\t` in the first line (FM CSV may be locale-delimited).
4. Neither yields ≥ 2 columns with ≥ 1 recognized header (see §5) → reject with error `UNRECOGNIZED_FORMAT` and a human message pointing to the export guide.

### HTML path

- Stream-tokenize; extract only `<th>`/`<td>` text inside the first `<table>`. Ignore attributes, scripts, styles entirely.
- First row (or `<th>` row) = headers. Subsequent `<tr>` = players.
- Decode HTML entities (`&amp;`, `&#xE9;` …). Trim and collapse internal whitespace.
- Rows whose cell count ≠ header count: pad/truncate if off by ≤ 2 trailing cells (a known FM quirk with merged trailing columns); otherwise report row as `MALFORMED_ROW`.

### CSV path

- RFC-4180 parsing with the detected delimiter; tolerate unquoted fields.
- Same header/row rules as HTML.

## 5. Header mapping

Headers are normalized (`lowercase`, strip non-alphanumerics) then looked up in a **synonym table** that maps to canonical attribute/field IDs (doc 04). Examples:

| Canonical ID | Accepted headers (normalized) |
|---|---|
| `name` | `name`, `playername` |
| `positions` | `position`, `positions`, `pos`, `posrolesduty` |
| `finishing` | `finishing`, `fin` |
| `firstTouch` | `firsttouch`, `fir` |
| `workRate` | `workrate`, `wor`, `wr` |
| `jumpingReach` | `jumpingreach`, `jum` |
| `transferValue` | `transfervalue`, `value`, `val` |
| … | full table lives in `src/import/header-synonyms.ts`, generated from the registry in doc 04 |

FM's short column codes (three-letter abbreviations shown when columns are narrow) **must** all be present in the synonym table — pull the complete list from the attribute registry (doc 04 defines both long name and FM short code for every attribute).

Rules:

- Unrecognized headers → kept as ignored columns, listed in the import report (`UNMAPPED_COLUMNS`) so we learn new synonyms from real uploads.
- Duplicate mapped headers (e.g. GK "Passing" and outfield "Passing" both present) → first occurrence wins for outfielders; for GK-category duplicates prefer the GK column when `positions` contains `GK`.
- Minimum viable import: `name` + `positions` + ≥ 20 mapped attributes. Below that → reject `INSUFFICIENT_COLUMNS` listing what's missing.

## 6. Value coercion

Per-cell rules. Coercion failures never kill the row — the field becomes `null` and the cell is reported.

### 6.1 Attributes (1–20 scale)

| Raw cell | Parsed as |
|---|---|
| `14` | `{ min: 14, max: 14 }` |
| `10-14` (also `10–14` en-dash) | `{ min: 10, max: 14 }` |
| `-`, `–`, empty | `null` (masked/unknown) |
| anything else | `null` + report `BAD_ATTRIBUTE_VALUE` |

All downstream math uses the **midpoint** (`(min+max)/2`) and carries an `uncertainty = max - min` flag; UI renders ranged values distinctly (doc 09). Values outside 1–20 after parsing → clamp and report.

### 6.2 Position string

FM position strings look like: `D (RC)`, `DM`, `M/AM (L)`, `ST (C)`, `GK`, `D (C), DM` , `M (C)`, `AM (RLC)`.

Grammar: comma-separated groups; each group = position token(s) separated by `/` + optional side list in parens (`R`, `L`, `C` characters).

Parse into a set of `{ slot, side }` pairs over canonical slots: `GK, D, WB, DM, M, AM, ST` and sides `L, C, R`. Examples:

- `D (RC)` → `D-R`, `D-C`
- `M/AM (L)` → `M-L`, `AM-L`
- `ST (C)` → `ST-C`
- `GK` → `GK`
- Unparseable → keep raw string, mark player `positionUnknown`, report.

### 6.3 Money (Transfer Value, Wage)

Examples seen in exports: `€2.3M`, `£450K`, `$1.2M - $2.4M`, `€0`, `Not for Sale`, `N/A`, `€10.5M p/a`, `€2.9K p/w`.

- Strip currency symbol → record `currency` per dataset (first symbol seen wins; mixed symbols → report once).
- `K` = ×1e3, `M` = ×1e6, `B` = ×1e9. Decimal comma tolerated (`2,3M`).
- Ranges → `{min,max}`, same as attributes.
- `Not for Sale`, `Unknown`, `N/A`, `-` → `null` + boolean flag where meaningful (`notForSale`).
- Wage period suffix `p/w`/`p/m`/`p/a` → normalize to per-week.

### 6.4 Other fields

- `age`: integer; `height`: parse `183 cm` or `6'0"` to cm.
- `expires`: parse common date formats (`30/6/2027`, `30.6.2027`, `Jun 30, 2027`) with day-first preference; store ISO date or `null`.
- `preferredFoot` / foot ratings: map FM strings (`Left`, `Right`, `Either`; foot strength `Very Strong`…`Very Weak`) to enums.
- `caStars`/`paStars` if present (ability stars from squad view): parse `3.5` or star glyphs to half-star float 0–5. These are scout opinions, not CA/PA — label accordingly.

## 7. Deduplication & re-upload

Within one file: duplicate rows (same name + age + club + identical attribute vector) collapse to one, reported as `DUPLICATE_ROW`.

Across uploads: when a user uploads into an existing **save series** (they pick "this is a newer export of save X"), players are matched by `name + nationality + (age within ±1 of expected aging)`; matches link to the same `playerIdentity` so shortlists and attribute-delta history survive re-imports (doc 04 §5). Unmatched old players are marked `departed` in the series, new ones `arrived`.

## 8. Import report

Stored per import, surfaced in UI after every upload:

```jsonc
{
  "rowsTotal": 21432,
  "rowsImported": 21418,
  "rowsSkipped": [ { "row": 302, "reason": "MALFORMED_ROW" } ],
  "unmappedColumns": ["Inf", "Rec"],
  "cellIssues": { "BAD_ATTRIBUTE_VALUE": 12 },
  "maskedAttributeShare": 0.31,   // drives a UI banner: "31% of attributes are ranged/unknown — scout more for sharper scores"
  "currency": "EUR",
  "detectedFormat": "html",
  "parserVersion": "1.3.0"
}
```

## 9. Test fixtures (must exist before parser work starts)

`/tests/fixtures/`:

1. `squad-small.html` — one club, ~30 players, full attributes.
2. `database-large.html` — ≥ 20k rows (may be synthesized by repeating + perturbing real rows).
3. `search-masked.html` — scouted search results with heavy `-` and `10-14` ranges.
4. `squad.csv` — CSV twin of fixture 1, semicolon-delimited.
5. `hostile.html` — wrong cell counts, HTML entities in names (`O&#39;Neill`), `<script>` inside a cell, mixed currencies, an unparseable position.
6. `not-an-export.html` — arbitrary webpage; must be rejected with `UNRECOGNIZED_FORMAT`.

Acceptance for the import module = all fixtures produce the exact expected normalized output committed as snapshot JSON next to each fixture.
