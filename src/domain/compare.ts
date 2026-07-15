import type { AttributeId } from "./attributes.js";
import type { AttrVector } from "./attr-value.js";
import { midOf } from "./attr-value.js";
import type { DerivedId } from "./derived.js";
import type { PositionSlot } from "./positions.js";
import { ROLES } from "./roles/registry.js";
import { pairScore } from "./roles/score.js";

/** Eight derived metrics for cross-player radar (doc 08 §5). */
export const COMPARE_DERIVED: readonly DerivedId[] = [
  "finishingPkg",
  "creativity",
  "pressResist",
  "speed",
  "workEngine",
  "aerial",
  "defActivity",
  "defPosition",
];

export interface RolePairFit {
  readonly ipId: string;
  readonly oopId: string;
  readonly ipName: string;
  readonly oopName: string;
  readonly score: number;
}

/** Best IP+OOP pair the player can play at this slot (brute-force over registry roles). */
export function bestPairForSlot(attrs: AttrVector, slot: PositionSlot): RolePairFit | null {
  const here = ROLES.filter((r) => r.slots.includes(slot));
  const ipRoles = here.filter((r) => r.phase === "IP");
  const oopRoles = here.filter((r) => r.phase === "OOP");
  if (ipRoles.length === 0 || oopRoles.length === 0) return null;

  let best: RolePairFit | null = null;
  for (const ip of ipRoles) {
    for (const oop of oopRoles) {
      const score = pairScore(attrs, ip.id, oop.id);
      if (!best || score > best.score) {
        best = {
          ipId: ip.id,
          oopId: oop.id,
          ipName: ip.name,
          oopName: oop.name,
          score,
        };
      }
    }
  }
  return best;
}

/** Highest midpoint among players with a known value at this attribute. */
export function bestAttrMid(
  attrs: readonly AttrVector[],
  id: AttributeId,
): { readonly value: number; readonly winners: readonly number[] } | null {
  const vals = attrs.map((a, i) => ({ i, v: midOf(a, id) }));
  const known = vals.filter((x): x is { i: number; v: number } => x.v != null);
  if (known.length === 0) return null;
  const top = Math.max(...known.map((x) => x.v));
  return { value: top, winners: known.filter((x) => x.v === top).map((x) => x.i) };
}
