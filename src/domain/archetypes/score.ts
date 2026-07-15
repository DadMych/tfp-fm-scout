import { ARCHETYPES, type ArchetypeDef, type GeneralFamily } from "./registry.js";

/**
 * Archetype scoring (docs/06-archetypes.md §2).
 *
 * base = Σ(weight × P(metric)) / Σ(weight) over metrics whose percentile is known.
 * Fail any gate → score capped at 40 (partial fit). Masked metrics are excluded from the
 * weighted mean and reduce confidence; a gate whose metric is unknown fails (conservative).
 */

const GATE_CAP = 40;

/** Lookups the caller provides from the dataset: percentile and raw midpoint per metric. */
export interface ScoringContext {
  pct(metric: string): number | null;
  raw(metric: string): number | null;
}

export interface ArchetypeScore {
  readonly id: string;
  readonly score: number; // 0–100
  readonly gatesPassed: boolean;
  readonly confidence: number; // 0–1: share of weight mass with a known percentile
}

const TIERS: readonly [keyof Pick<ArchetypeDef, "core" | "major" | "minor">, number][] = [
  ["core", 3],
  ["major", 2],
  ["minor", 1],
];

export function scoreArchetype(ctx: ScoringContext, def: ArchetypeDef): ArchetypeScore {
  let weighted = 0;
  let usedWeight = 0;
  let totalWeight = 0;

  for (const [tier, weight] of TIERS) {
    for (const metric of def[tier]) {
      totalWeight += weight;
      const p = ctx.pct(metric);
      if (p == null) continue;
      weighted += weight * p;
      usedWeight += weight;
    }
  }

  const base = usedWeight === 0 ? 0 : weighted / usedWeight;

  const gatesPassed = def.gates.every((g) => {
    const v = g.kind === "pct" ? ctx.pct(g.metric) : ctx.raw(g.metric);
    return v != null && v >= g.min;
  });

  const score = gatesPassed ? base : Math.min(base, GATE_CAP);
  const confidence = totalWeight === 0 ? 0 : usedWeight / totalWeight;
  return { id: def.id, score, gatesPassed, confidence };
}

/** Score every archetype for the given population (skip GK archetypes for outfielders). */
export function scoreAllArchetypes(
  ctx: ScoringContext,
  pop: "outfield" | "gk",
): ArchetypeScore[] {
  return ARCHETYPES.filter((a) => a.pop === pop).map((a) => scoreArchetype(ctx, a));
}

export type Badge = "Elite" | "Strong" | "Notable" | null;

export function badgeFor(score: number, gatesPassed: boolean): Badge {
  if (!gatesPassed || score < 60) return null;
  if (score >= 85) return "Elite";
  if (score >= 70) return "Strong";
  return "Notable";
}

export interface GeneralArchetype {
  readonly family: GeneralFamily | "Utility";
  /** Second family when the top two are a close cross-family hybrid (doc 06 §9). */
  readonly hybridWith: GeneralFamily | null;
  readonly primaryId: string | null;
  /** Runner-up archetype id when a hybrid applies (drives the "and also" summary clause). */
  readonly runnerUpId: string | null;
}

/**
 * Resolve the player's general archetype (doc 06 §9): the family of the primary archetype
 * (top scorer that passes gates and reaches ≥ 60), with a hybrid when the runner-up is a
 * different family within 6 points. No qualifying archetype → Utility.
 */
export function generalArchetype(scores: readonly ArchetypeScore[]): GeneralArchetype {
  const eligible = scores
    .filter((s) => s.gatesPassed && s.score >= 60)
    .sort((a, b) => b.score - a.score);

  const primary = eligible[0];
  if (!primary) {
    return { family: "Utility", hybridWith: null, primaryId: null, runnerUpId: null };
  }

  const primaryFamily = famOf(primary.id);
  let hybridWith: GeneralFamily | null = null;
  let runnerUpId: string | null = null;
  const runnerUp = eligible.find((s) => famOf(s.id) !== primaryFamily);
  if (runnerUp && primary.score - runnerUp.score <= 6) {
    hybridWith = famOf(runnerUp.id);
    runnerUpId = runnerUp.id;
  }
  return { family: primaryFamily, hybridWith, primaryId: primary.id, runnerUpId };
}

function famOf(id: string): GeneralFamily {
  const a = ARCHETYPES.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown archetype id: ${id}`);
  return a.family;
}
