/**
 * Deterministic decline projection (docs/13-sporting-director.md §3). We never project
 * growth — only ageing decline from current attributes/fit. Reads raw attribute midpoints
 * (1–20), never dataset-relative percentiles (doc 11 §0.4 is load-bearing here too).
 */

import { midOf } from "../../attr-value.js";
import type { Player } from "../../player.js";
import { isGoalkeeper } from "../../player.js";

const GK_RELIANCE = 0.35;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** How much of a player's game depends on legs (0–1). GKs age slowly, fixed value. */
export function physicalReliance(player: Player): number {
  if (isGoalkeeper(player)) return GK_RELIANCE;
  const ids = ["pace", "acceleration", "agility", "stamina"] as const;
  const values = ids.map((id) => midOf(player.attrs, id)).filter((v): v is number => v != null);
  if (values.length === 0) return 0.5;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return clamp01(avg / 16);
}

function decayPerSeason(ageAtSeason: number): number {
  if (ageAtSeason <= 29) return 0;
  if (ageAtSeason <= 31) return 1.5;
  if (ageAtSeason <= 33) return 3;
  return 5;
}

/** Projected best-role/slot fit after `seasons` years, from current age and reliance. */
export function projectFit(fit: number, age: number | null, reliance: number, seasons: 1 | 2 | 3): number {
  if (age == null) return fit;
  let projected = fit;
  for (let i = 1; i <= seasons; i++) {
    const decay = decayPerSeason(age + i) * (0.5 + reliance);
    projected -= decay;
  }
  return Math.max(0, Math.round(projected));
}

const VALUE_MULTIPLIER: readonly (readonly [number, number])[] = [
  [27, 1.0],
  [29, 0.9],
  [30, 0.75],
  [31, 0.55],
  [32, 0.4],
  [33, 0.25],
];

/** Expected resale multiplier of a player's current value at a given future age. */
export function valueMultiplier(ageAtSale: number): number {
  for (const [maxAge, mult] of VALUE_MULTIPLIER) {
    if (ageAtSale <= maxAge) return mult;
  }
  return 0.1;
}

/** Expected resale value if sold at `ageAtSale`. */
export function projectValue(value: number, ageAtSale: number): number {
  return Math.round(value * valueMultiplier(ageAtSale));
}
