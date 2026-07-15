/**
 * Squad Health Index — one trackable number plus five subscores (docs/13 §9).
 */

import type { AnalysisContext } from "../context.js";
import type { SlotNeed } from "../slots.js";
import type { SquadHealth, SuccessionEntry } from "./types.js";

const NEED_SCORE: Record<SlotNeed, number> = { hole: 0, weak: 0.3, thin: 0.55, ageing: 0.55, solid: 1 };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Target share of the XI in each age band (docs/13 §9).
const AGE_BANDS: readonly { readonly max: number; readonly target: number }[] = [
  { max: 21, target: 0.1 },
  { max: 24, target: 0.2 },
  { max: 29, target: 0.45 },
  { max: Infinity, target: 0.25 },
];

function bandIndex(age: number): number {
  const i = AGE_BANDS.findIndex((b) => age <= b.max);
  return i === -1 ? AGE_BANDS.length - 1 : i;
}

export function buildHealth(ctx: AnalysisContext, succession: readonly SuccessionEntry[]): SquadHealth {
  const xiQuality = clamp01((ctx.avgFit - 50) / 35) * 100;

  const depth =
    ctx.slots.length > 0
      ? (ctx.slots.reduce((sum, s) => sum + NEED_SCORE[s.need], 0) / ctx.slots.length) * 100
      : 0;

  const startersWithAge = ctx.slots.filter((s) => s.starter && s.starterAge != null);
  let ageBalance = 100;
  if (startersWithAge.length > 0) {
    const shares = AGE_BANDS.map(() => 0);
    for (const s of startersWithAge) {
      const i = bandIndex(s.starterAge!);
      shares[i] = (shares[i] ?? 0) + 1;
    }
    const total = startersWithAge.length;
    const diff = AGE_BANDS.reduce((sum, b, i) => sum + Math.abs((shares[i] ?? 0) / total - b.target), 0);
    ageBalance = 100 - (100 * diff) / 2;
  }

  const successionScore =
    succession.length > 0 ? (succession.filter((e) => e.horizon >= 2).length / succession.length) * 100 : 100;

  const values = ctx.squad.map((r) => r.player.value).filter((v): v is number => v != null);
  const total = values.reduce((s, v) => s + v, 0);
  let liquidity = 50;
  if (total > 0) {
    const youngValue = ctx.squad
      .filter((r) => r.player.value != null && (r.player.age ?? 99) <= 29)
      .reduce((s, r) => s + (r.player.value ?? 0), 0);
    liquidity = (youngValue / total) * 100;
  }

  const index = Math.round(
    0.35 * xiQuality + 0.2 * depth + 0.15 * ageBalance + 0.2 * successionScore + 0.1 * liquidity,
  );

  return {
    index,
    xiQuality: Math.round(xiQuality),
    depth: Math.round(depth),
    ageBalance: Math.round(ageBalance),
    succession: Math.round(successionScore),
    liquidity: Math.round(liquidity),
  };
}
