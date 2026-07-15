# 21 — Tactic briefing & playing styles

**Amends** docs 07 (squad DNA), 08 (scout presets), 11 (assistant), 19 §3 (style reads).

## Problem

"How to play it" was four generic rules with no left/right asymmetry, no named
playing styles, and Scout buttons from insights dropped their filters. Formation
chips already re-ran the report — the missing piece was a real briefing layer.

## Playing styles

Catalogue in `src/domain/squad/styles.ts`:

| Id | Focus |
|----|--------|
| `tiki-taka` | pressResist + creativity + Progressor/Creator |
| `gegenpress` | workEngine + speed + Destroyer/Engine |
| `counter` | speed + Runner/Engine/Carrier |
| `direct` | aerial + Focal Point |
| `wing-play` | speed/mobility on the flanks |
| `low-block` | defPosition + Destroyer/General |

Each style has metric thresholds, family counts, **formation affinity**, and a
**scout template** (key derived metrics + position groups).

`styleSuitability(ctx, style)` → 0–100 with evidence and a `missing` list.
Affinity multiplies the score so 4-3-3 prefers tiki-taka / gegenpress, 4-4-2
prefers direct / low-block / counter.

## Tactic brief

`buildTacticBrief(ctx, linkBoard)` returns:

1. Top 3 styles for this XI in this shape
2. **Flank advice** — left and right independently (overlap, invert/underlap, or stay home)
3. **Slot notes** — ST target vs runner, DM progressor vs anchor, CB step-out
4. `styleReads` — prose for VerdictBar (absorbs doc 19 §3, with stamina/crossing and aggression/pressResist)

UI: `TacticBriefing` between VerdictBar and the pitch. Formation chips refresh the brief.

## Scout presets

- URL param `style=<StyleId>` on `/scout`
- Desk filter: player passes if average group percentile on the style's key metrics ≥ 60
- "Scout for {style}" on the briefing → `/scout?style=…&group=…&sort=fit`
- Insight "Scout" actions now serialize filters via `serializeAssistantScoutFilters`

## Acceptance

1. Changing formation re-ranks styles and can flip flank advice L≠R on asymmetric XIs.
2. `/scout?style=gegenpress` filters the ledger to press-capable profiles.
3. Insight Scout links are never bare `/scout` when filters exist.
4. `pnpm check` green; style suitability is deterministic.
