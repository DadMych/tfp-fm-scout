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
| `release`, `sell-now`, `sell-high` | Sale — frees a place, adds fee to cash |
| `loan-out` | Loan — frees a place, no fee |

Priority when picking exits: sell-now → sell-high → release → loan-out, then
**registration culls** synthesised from fringe `keep` players (loan if ≤21, else release)
when board exits alone cannot land under the cap.

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

## Prospects

A **prospect** move is a shortlist player aged ≤ `PROSPECT_AGE` (21) signed to develop.
He is immediately marked loan-out: he does **not** occupy a registered place and does not
need an XI slot. Strategy `prospects` ("Prospect pipeline") builds a window of such
signings; other strategies may still displace squad kids via loan-out exits.

## `windowSummary`

Example: `5 in (1 prospect on loan), 3 sold for €18M, 1 loaned — squad 24/25`.

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
