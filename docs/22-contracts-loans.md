# 22 · Contracts, wages & loans

The FM26 export (vinteset preset v2) carries columns the engine previously ignored:
`Wage`, `Expires`, `On Loan From`, `Loan Duration`, `Last Transfer Fee`, `Preferred Foot`,
`Style`, `Club` and the `Inf` status column. This doc specifies how they flow into the
model and what analytics they unlock. Amends doc 13 (sale verdicts) and doc 20 (exits).

## 1. Model & persistence

New optional `Player` fields, all JSON-safe (dates are ISO strings):

| Field | Source column | Notes |
|---|---|---|
| `wage` | Wage | per-week number; ranges ("€18K - €21K p/w") take the midpoint |
| `contractExpires` | Expires | `"2028-06-30"` |
| `onLoanFrom` | On Loan From | the **owning** club |
| `loanEnd` | Loan Duration | end date of "14/7/25 - 30/6/26" |
| `lastTransferFee` | Last Transfer Fee | `(€1)` loan nominals and `€0` normalize to null |
| `flags` | Inf | `injured` (Inj), `wanted` (Wnt), `loan-listed` (Loa), `transfer-listed` (Trn) |
| `playStyle` | Style | FM's one-word label ("Creative", "Physical" …) |
| `foot` | Preferred Foot | direct column wins over Right/Left Foot strength inference |

Hosted persistence packs them into one `players.meta` jsonb column
(migration `drizzle/0002_player_meta.sql`); the Zod schemas on both dataset APIs accept them.
IndexedDB (logged-out) stores the full `Player` object and needs nothing.

## 2. Loan direction (`src/domain/squad/status.ts`)

`On Loan From` names the owning club, so direction falls out of comparing it with *our*
club — itself inferred as the modal club across the squad export (`ourClubOf`):

- **loaned-in** — owned elsewhere. Still occupies a registered place, but is *never* an
  exit candidate: `buildSales` returns `keep` ("not yours to sell"), and registration
  culls skip him.
- **loaned-out** — ours, parked at another club. Excluded from the working squad in
  `buildContext` (he can't play or be picked this season) and listed in `ctx.loanedOut`.
  A `con.loan-returns` insight ranks the returning players by preset fit.

## 3. Season clock without a wall clock

Exports carry no "today". FM contracts and loan spells all end June 30, so the earliest
`contractExpires`/`loanEnd` in the dataset marks the current season's end (`seasonEndOf`).

- **Expiring** (`contractExpires <= seasonEnd`): free agent in under a year.
  - Starter → `con.renew-or-lose` (critical): renew or watch the value walk.
  - Non-starter → sale verdict escalates to **sell-now** ("sell or he walks for free"),
    with the ask collapsed to `EXPIRING_FEE_FRAC` (50%) of the normal band.
- **Penultimate** (ends one season later) → `con.final-year` (medium): renew starters
  this window while a real fee is still possible.

## 4. Market side

- **Bosman targets** — shortlist players whose contracts end this season and rate at
  least `WEAK_FIT`: `con.bosman` (high). Packages price them at `EXPIRING_FEE_FRAC` of
  value (`signingCost`), and the move's why-sentence notes the cut price.
- **Wage dead weight** — fringe players (not XI, not first-choice cover) earning above
  the squad's `WAGE_HEAVY_PCT` (75th) wage percentile: `con.wage-dead-weight` with the
  yearly saving. Requires ≥8 squad wages to be meaningful.
- **Wanted** (`Wnt`) adds "clubs are already circling" to sell-now/sell-high reasons.

## 5. UI

- **Dossier** facts rail: wage, contract end (+ "expiring"), loan line, last fee, FM style.
- **Scout desk**: "Free this summer" (gold) and "On loan" stamps in the name cell.
- **Player peek card** (hover/hold): wage · contract end, and loan origin.

## 6. Thresholds (doc 11 §4 addendum)

| Key | Value | Meaning |
|---|---|---|
| `EXPIRING_FEE_FRAC` | 0.5 | fee multiplier for expiring contracts, both selling and buying |
| `WAGE_HEAVY_PCT` | 75 | wage percentile above which a fringe player is dead weight |
