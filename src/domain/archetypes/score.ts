import { ARCHETYPES, type ArchetypeDef, type ArchetypeId, type GeneralFamily, type GateCohort } from "./registry.js";
import type { MetricId } from "../metric-id.js";

/**
 * Archetype scoring (docs/06-archetypes.md §2).
 *
 * base = Σ(weight × P(metric)) / Σ(weight) over metrics whose percentile is known.
 * Fail any gate → score capped at 40 (partial fit). Masked metrics are excluded from the
 * weighted mean and reduce confidence; a gate whose metric is unknown fails (conservative).
 */

const GATE_CAP = 40;

/** Compress scores above the knee so Elite (≥85) stays rare on large lists (doc 06 §7 #2). */
const ELITE_TAIL_KNEE = 82;
const ELITE_TAIL_SLOPE = 0.58;

function compressEliteTail(score: number): number {
  if (score <= ELITE_TAIL_KNEE) return score;
  return Math.round(ELITE_TAIL_KNEE + (score - ELITE_TAIL_KNEE) * ELITE_TAIL_SLOPE);
}

/** Lookups the caller provides from the dataset: percentile and raw midpoint per metric. */
export interface ScoringContext {
  pct(metric: MetricId): number | null;
  raw(metric: MetricId): number | null;
  /** Percentile within a special cohort (e.g. CB + FB/WB for Recovery Sprinter). */
  cohortPct?(cohort: GateCohort, metric: MetricId): number | null;
}

export interface ArchetypeScore {
  readonly id: ArchetypeId;
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
    const v =
      g.kind === "pct"
        ? g.cohort && ctx.cohortPct
          ? ctx.cohortPct(g.cohort, g.metric)
          : ctx.pct(g.metric)
        : ctx.raw(g.metric);
    return v != null && v >= g.min;
  });

  const score = gatesPassed ? compressEliteTail(base) : Math.min(base, GATE_CAP);
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
  readonly primaryId: ArchetypeId | null;
  /** Runner-up archetype id when a hybrid applies (drives the "and also" summary clause). */
  readonly runnerUpId: ArchetypeId | null;
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
  let runnerUpId: ArchetypeId | null = null;
  const runnerUp = eligible.find((s) => famOf(s.id) !== primaryFamily);
  if (runnerUp && primary.score - runnerUp.score <= 6) {
    hybridWith = famOf(runnerUp.id);
    runnerUpId = runnerUp.id;
  }
  return { family: primaryFamily, hybridWith, primaryId: primary.id, runnerUpId };
}

function famOf(id: ArchetypeId): GeneralFamily {
  const a = ARCHETYPES.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown archetype id: ${id}`);
  return a.family;
}
