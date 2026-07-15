import type { AttributeId } from "./attributes.js";
import { midOf, type AttrVector } from "./attr-value.js";

/**
 * Derived metrics (docs/04-data-model.md §4).
 *
 * Each metric is a small fixed formula over attribute midpoints. A metric is `null`
 * when any of its inputs is masked/missing — we do not guess. Confidence handling and
 * percentile ranking live elsewhere; this module is just the arithmetic.
 */

export type DerivedMetrics = Record<DerivedId, number | null>;

/** Attributes each metric depends on (drives null-propagation and confidence). */
export const DERIVED_INPUTS = {
  speed: ["acceleration", "pace"],
  workEngine: ["workRate", "stamina"],
  aerial: ["jumpingReach", "heading", "strength"],
  pressResist: ["firstTouch", "composure", "balance", "agility"],
  creativity: ["vision", "passing", "flair"],
  defActivity: ["tackling", "aggression", "anticipation"],
  defPosition: ["positioning", "marking", "concentration"],
  finishingPkg: ["finishing", "composure", "offTheBall"],
  mobility: ["agility", "balance", "acceleration"],
  physicality: ["strength", "jumpingReach", "stamina", "balance"],
} as const satisfies Record<string, readonly AttributeId[]>;

export type DerivedId = keyof typeof DERIVED_INPUTS;

const MAX_ATTR = 20;

type Nums = Record<AttributeId, number>;

/**
 * Resolve every input midpoint for a metric. Returns null if any input is masked,
 * so the caller (and the metric formula) never operates on partial data.
 */
function resolve(attrs: AttrVector, ids: readonly AttributeId[]): Nums | null {
  const out = {} as Nums;
  for (const id of ids) {
    const m = midOf(attrs, id);
    if (m == null) return null;
    out[id] = m;
  }
  return out;
}

export function computeDerived(attrs: AttrVector): DerivedMetrics {
  const metric = (id: DerivedId, f: (n: Nums) => number): number | null => {
    const n = resolve(attrs, DERIVED_INPUTS[id]);
    return n == null ? null : f(n);
  };

  return {
    speed: metric("speed", (n) => (n.acceleration + n.pace) / 2),
    workEngine: metric("workEngine", (n) => (n.workRate + n.stamina) / 2),
    // Aerial gets a strength bonus, capped at the attribute ceiling.
    aerial: metric("aerial", (n) =>
      Math.min(MAX_ATTR, (n.jumpingReach + n.heading) / 2 + n.strength / 4),
    ),
    pressResist: metric(
      "pressResist",
      (n) => (n.firstTouch + n.composure + n.balance + n.agility) / 4,
    ),
    creativity: metric("creativity", (n) => (n.vision + n.passing + n.flair) / 3),
    defActivity: metric(
      "defActivity",
      (n) => (n.tackling + n.aggression + n.anticipation) / 3,
    ),
    defPosition: metric(
      "defPosition",
      (n) => (n.positioning + n.marking + n.concentration) / 3,
    ),
    finishingPkg: metric(
      "finishingPkg",
      (n) => (n.finishing + n.composure + n.offTheBall) / 3,
    ),
    mobility: metric("mobility", (n) => (n.agility + n.balance + n.acceleration) / 3),
    physicality: metric(
      "physicality",
      (n) => (n.strength + n.jumpingReach + n.stamina + n.balance) / 4,
    ),
  };
}
