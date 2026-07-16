/**
 * Sale price bands from transfer value + age (docs/13-sporting-director.md §4.3).
 */

import { valueMultiplier } from "./ageing.js";
import { T } from "../thresholds.js";
import type { PriceBand } from "./types.js";

function round3sig(n: number): number {
  if (n === 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(n))) - 2);
  return Math.round(n / magnitude) * magnitude;
}

/** Expected proceeds from a sale at list value (doc 19 §4: −10% haircut). */
export function saleProceeds(value: number): number {
  return round3sig(value * T.SALE_HAIRCUT);
}

/** Expected fee for selling now, plus a negotiation band. `null` when value is unknown. */
export function computePriceBand(
  value: number | null,
  age: number | null,
  isRelease: boolean,
  isExpiring = false,
): PriceBand | null {
  if (value == null) return null;
  const mult = age != null ? valueMultiplier(age) : 1;
  let fee = value * mult * T.SALE_HAIRCUT;
  if (isRelease) fee *= 0.5;
  // Buyers know an expiring player walks for free next summer — the fee collapses.
  else if (isExpiring) fee *= T.EXPIRING_FEE_FRAC;
  return {
    low: round3sig(fee * 0.85),
    ask: round3sig(fee),
    high: round3sig(fee * 1.15),
  };
}
