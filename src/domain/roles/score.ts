import type { AttributeId } from "../attributes.js";
import { midOf, uncertainty, type AttrVector } from "../attr-value.js";
import { computeDerived } from "../derived.js";
import { getRole, type RoleDef, type RoleId } from "./registry.js";

/**
 * Role scoring (docs/05-role-engine.md §1).
 *
 * score = 100 × Σ(weight × midpoint) / Σ(weight × 20), over attributes that are NOT masked.
 * Masked attributes are excluded from both sums (score is over known attributes) and reduce
 * confidence. Ranged attributes use their midpoint.
 */

const TIERS: readonly [keyof Pick<RoleDef, "core" | "major" | "minor">, number][] = [
  ["core", 3],
  ["major", 2],
  ["minor", 1],
];

const MAX_ATTR = 20;

export interface RoleScore {
  readonly score: number; // 0–100
  readonly confidence: number; // 0–1: share of weight mass that is exact
  readonly insufficient: boolean; // >50% of weight mass masked
}

export function scoreRole(attrs: AttrVector, role: RoleDef): RoleScore {
  let raw = 0;
  let maxRaw = 0;
  let totalWeight = 0;
  let exactWeight = 0;
  let maskedWeight = 0;

  for (const [tier, weight] of TIERS) {
    for (const id of role[tier] as readonly AttributeId[]) {
      totalWeight += weight;
      const m = midOf(attrs, id);
      if (m == null) {
        maskedWeight += weight;
        continue;
      }
      raw += weight * m;
      maxRaw += weight * MAX_ATTR;
      if (uncertainty(attrs[id]) === 0) exactWeight += weight;
    }
  }

  const rawScore = maxRaw === 0 ? 0 : (100 * raw) / maxRaw;
  const confidence = totalWeight === 0 ? 0 : exactWeight / totalWeight;
  const insufficient = totalWeight > 0 && maskedWeight / totalWeight > 0.5;
  const score = insufficient
    ? Math.round(rawScore * (1 - maskedWeight / totalWeight))
    : Math.round(rawScore);
  return { score, confidence, insufficient };
}

export function scoreRoleById(attrs: AttrVector, roleId: RoleId): RoleScore {
  return scoreRole(attrs, getRole(roleId));
}

/**
 * IP + OOP role-pair fit (docs/05-role-engine.md §4).
 * pairScore = 0.55·ip + 0.45·oop, minus a stamina tax when both roles are running-heavy
 * (stamina or workRate in Core) and the player's work engine is below 12.
 */
export function pairScore(attrs: AttrVector, ipRoleId: RoleId, oopRoleId: RoleId): number {
  const ip = getRole(ipRoleId);
  const oop = getRole(oopRoleId);
  const base = 0.55 * scoreRole(attrs, ip).score + 0.45 * scoreRole(attrs, oop).score;

  const runningHeavy = (r: RoleDef) =>
    r.core.includes("stamina") || r.core.includes("workRate");

  let tax = 0;
  if (runningHeavy(ip) && runningHeavy(oop)) {
    const derived = computeDerived(attrs);
    const stamina = midOf(attrs, "stamina");
    const workRate = midOf(attrs, "workRate");
    const workEngine = derived.workEngine;
    const running =
      stamina != null && workRate != null
        ? workEngine
        : stamina != null
          ? stamina
          : workRate;
    if (running != null && running < 12) tax = (12 - running) * 2;
  }
  return base - tax;
}
