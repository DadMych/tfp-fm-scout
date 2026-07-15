# 20 — Squad discipline & honest cash

**Amends** docs 13 (packages v4), 19 §4 (honest funding). Wins on conflict.

## Problem

Packages could print `5 in, 0 sold, 5 to the bench — squad grows to 35` with no gate.
Sales only attached when `totalCost > budgetCap`, so sale proceeds never funded a stronger
window. Loan-out lived on the Sporting Director board as advice only. The Fit desk filter
"Improves my XI" required slot delta ≥ 8 while the Verdict column's "Squad upgrade" used ≥ 5.

## Invariant

**Every transfer package ends with a registered squad size ≤ `squadCap` (default 25).**

Players **loaned out** do not count toward the registered size. Wage/contract are still out of
scope (doc 11 §12) — cash is transfer value × `SALE_HAIRCUT` only.

## Exits plan

Every package carries an **exits** block drawn from `buildSales` verdicts:

| Verdict | Effect |
|---------|--------|
| `sell-now`, `sell-high` | Sale — frees a place, adds fee to cash |
| `loan-out` | External loan — frees a place, no fee |
| `b-team` | Junior / B-team move — frees a place, no fee |
| `release` | Sale of last resort — frees a place; only older low-value fringe |

Priority when picking exits — three passes:

1. **Cash**: sales (sell-now → sell-high → release) only up to what the plan actually
   needs beyond the cap; penny fees (< `MIN_FUNDING_SALE`) never fund a window.
2. **Places**: loans and B-team moves free registration slots without selling assets.
3. **Last resort**: further sales for size only when loans cannot free enough places.

Registration culls are synthesised from fringe `keep` players (loan if ≤21, B-team if
≤23, release only when value ≥ `MIN_FUNDING_SALE` or unknown) and rank after genuine
board exits within each pass.

**No plan sells a player it doesn't need to sell.** A plan whose cost fits the cap
attaches zero sales unless loans can't cover the registration squeeze.

If the engine cannot free enough places to land ≤ `squadCap`, the package is discarded.

## Honest cash

```
effectiveBudget = strategyCap + income(sales)
netSpend        = totalCost − income
```

The assembler may buy up to `effectiveBudget`. Doc 19's "no sales when affordable" is
**replaced**: exits always run when size pressure or funding pressure exists. Card copy
always shows gross / income / net spend when income > 0.

`fundingNote` explains the maths when sales fund the window.

The **Self-funding rebuild** (churn) is not clipped by the cash budget at all: every euro
its sales raise is reinvestable, since net spend ≤ 0 is enforced. Selling a €59M starter
means the plan may sign a €59M replacement — selling good players buys good players.

Churn only draws from **sell-high / sell-now** board exits (max `CHURN_MAX_SALES`, default 3)
and caps assembly at `min(sale income, 2× budget)`. No fringe releases, no seven-player
fire sales for a +1 window.

## Smart swaps

When the Sporting Director flags arbitrage (`sell-high` + shortlist twin with negative
`netCost`), `buildSwapPackages` emits a **Smart swaps** plan: sell Scott, sign Iwobi, etc.
Forced sales run in exits pass 0 so the window always executes the insight, not a permutation.

Packages rank by **lift × efficiency − sales penalty**, not raw `afterFit` alone — so a
profitable swap or a tight Moneyball window can headline ahead of a noisy +2 that sells half
the bench.

Spender strategies (`spine`, `win-now`, `flanks`, `half-budget`) prefer players still in
their peak (`age ≤ AGE_PEAK_END`). **One** post-peak signing per package is allowed when
preset fit is elite (`≥ GOOD_FIT`, e.g. Pope 34 at GK 73). Depth cover stays in-prime only
— no pensioner bench behind a new starter.

## Prospects

A **prospect** move is a shortlist player aged ≤ `PROSPECT_AGE` (21) signed to develop.
He is immediately marked loan-out: he does **not** occupy a registered place and does not
need an XI slot. Strategy `prospects` ("Prospect pipeline") builds a window of such
signings; other strategies may still displace squad kids via loan-out exits.

## `windowSummary`

Example: `5 in (1 prospect on loan), 3 sold for €18M, 2 loaned, 1 to B team, squad 24/25`.

Zero counts are omitted (no more `0 loaned` filler).

## Fit desk alignment

`computeSquadFit` Upgrade threshold = **delta ≥ 5** (matches Verdict "Squad upgrade").
`fitsGap` accepts an Upgrade over a `solid` slot; hole/weak still require Upgrade.

## Controls

Assistant controls expose **Squad cap** (default 25) next to budget. Persisted with the
assistant run prefs.

## Acceptance

1. Every returned package has `squadAfter ≤ squadCap`.
2. When `income > 0`, `netSpend === totalCost − income` and purchases may exceed the bare
   budget cap by that income.
3. Loan exits appear in `loans` and free registered places without adding income.
4. Prospect strategy moves have `kind: "prospect"` and do not inflate `squadAfter`.
5. Fit filter "Improves my XI" keeps players with Fit stamp Upgrade at delta ≥ 5.
