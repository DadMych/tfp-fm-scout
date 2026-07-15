import { ATTRIBUTES, type AttributeId } from "../attributes.js";
import { midOf, uncertainty } from "../attr-value.js";
import { computeDerived, DERIVED_INPUTS, type DerivedMetrics, type DerivedId } from "../derived.js";
import { makeRanker, type Ranker } from "../percentile.js";
import { playerGroups, type PositionGroup } from "../positions.js";
import { isGoalkeeper, type Player } from "../player.js";
import { ROLES } from "../roles/registry.js";
import { scoreRole, type RoleScore } from "../roles/score.js";
import {
  scoreAllArchetypes,
  generalArchetype,
  badgeFor,
  type ArchetypeScore,
  type GeneralArchetype,
  type Badge,
} from "../archetypes/score.js";
import { getArchetype } from "../archetypes/registry.js";
import { generateSummary, type SummaryMetric } from "../archetypes/summary.js";

/**
 * Dataset-level scoring (docs/04-data-model.md §4, docs/02 pipeline step 3d).
 *
 * Percentiles are computed within the dataset, split by population (outfield vs GK), then
 * every engine runs per player. Pure and deterministic: same players in, same scores out.
 */

export type Population = "outfield" | "gk";

export interface PlayerScores {
  readonly playerId: string;
  readonly pop: Population;
  readonly derived: DerivedMetrics;
  /** metric id (attribute or derived) -> dataset percentile (null when masked). */
  readonly percentiles: Readonly<Record<string, number | null>>;
  readonly roles: Readonly<Record<string, RoleScore>>;
  readonly archetypes: readonly ArchetypeScore[];
  readonly general: GeneralArchetype;
  readonly summary: string;
  readonly confidence: number;
  readonly topArchetype: { id: string; score: number; badge: Badge } | null;
  readonly bestRole: { id: string; score: number } | null;
}

const ATTR_IDS = ATTRIBUTES.map((a) => a.id);
const DERIVED_IDS = Object.keys(DERIVED_INPUTS) as DerivedId[];
const METRIC_IDS: readonly string[] = [...ATTR_IDS, ...DERIVED_IDS];

const OUTFIELD_EXPECTED = ATTRIBUTES.filter(
  (a) => a.category === "technical" || a.category === "mental" || a.category === "physical",
).map((a) => a.id);
const GK_EXPECTED = [
  ...ATTRIBUTES.filter(
    (a) => a.category === "goalkeeping" || a.category === "mental" || a.category === "physical",
  ).map((a) => a.id),
  "firstTouch" as AttributeId,
  "passing" as AttributeId,
];

function isDerived(metric: string): metric is DerivedId {
  return metric in DERIVED_INPUTS;
}

function metricValue(
  attrs: Player["attrs"],
  derived: DerivedMetrics,
  metric: string,
): number | null {
  return isDerived(metric) ? derived[metric] : midOf(attrs, metric as AttributeId);
}

function confidenceFor(attrs: Player["attrs"], expected: readonly AttributeId[]): number {
  if (expected.length === 0) return 0;
  let exact = 0;
  for (const id of expected) if (uncertainty(attrs[id]) === 0) exact += 1;
  return exact / expected.length;
}

function primaryGroup(p: Player): PositionGroup {
  return playerGroups(p.positions)[0] ?? "DM/CM";
}

export function buildScores(players: readonly Player[]): PlayerScores[] {
  const derivedByPlayer = new Map<string, DerivedMetrics>();
  for (const p of players) derivedByPlayer.set(p.id, computeDerived(p.attrs));

  // Rankers per population per metric (sort once; O(log n) lookups thereafter).
  const rankers: Record<Population, Map<string, Ranker>> = {
    outfield: new Map(),
    gk: new Map(),
  };
  for (const pop of ["outfield", "gk"] as const) {
    const cohort = players.filter((p) => (isGoalkeeper(p) ? pop === "gk" : pop === "outfield"));
    for (const metric of METRIC_IDS) {
      const values = cohort.map((p) =>
        metricValue(p.attrs, derivedByPlayer.get(p.id) as DerivedMetrics, metric),
      );
      rankers[pop].set(metric, makeRanker(values));
    }
  }

  return players.map((p) => {
    const pop: Population = isGoalkeeper(p) ? "gk" : "outfield";
    const derived = derivedByPlayer.get(p.id) as DerivedMetrics;
    const rank = rankers[pop];

    const percentiles: Record<string, number | null> = {};
    const atOrAbove: Record<string, number> = {};
    for (const metric of METRIC_IDS) {
      const v = metricValue(p.attrs, derived, metric);
      const r = rank.get(metric) as Ranker;
      percentiles[metric] = v == null ? null : r.pct(v);
      if (v != null) atOrAbove[metric] = r.atOrAbove(v);
    }

    const ctx = {
      pct: (m: string) => percentiles[m] ?? null,
      raw: (m: string) => metricValue(p.attrs, derived, m),
    };

    // Roles: score all; best role prefers ones playable in the player's positions.
    const roles: Record<string, RoleScore> = {};
    for (const role of ROLES) roles[role.id] = scoreRole(p.attrs, role);
    const posSet = new Set(p.positions);
    let bestRole: PlayerScores["bestRole"] = null;
    let bestEligible = -1;
    let bestAny = -1;
    let bestAnyId = "";
    for (const role of ROLES) {
      const s = roles[role.id]!.score;
      if (s > bestAny) { bestAny = s; bestAnyId = role.id; }
      if (role.slots.some((slot) => posSet.has(slot)) && s > bestEligible) {
        bestEligible = s;
        bestRole = { id: role.id, score: s };
      }
    }
    if (!bestRole && bestAnyId) bestRole = { id: bestAnyId, score: bestAny };

    const archetypes = scoreAllArchetypes(ctx, pop);
    const general = generalArchetype(archetypes);

    // Top archetype: highest gate-passing score, else highest overall.
    const passing = archetypes.filter((a) => a.gatesPassed).sort((a, b) => b.score - a.score);
    const any = [...archetypes].sort((a, b) => b.score - a.score);
    const top = passing[0] ?? any[0];
    const topArchetype: PlayerScores["topArchetype"] = top
      ? { id: top.id, score: top.score, badge: badgeFor(top.score, top.gatesPassed) }
      : null;

    const confidence = confidenceFor(p.attrs, pop === "gk" ? GK_EXPECTED : OUTFIELD_EXPECTED);

    const metrics: SummaryMetric[] = [];
    for (const metric of METRIC_IDS) {
      const pctv = percentiles[metric];
      if (pctv != null) metrics.push({ metric, pct: pctv });
    }
    const summary = generateSummary({
      age: p.age,
      positionGroup: primaryGroup(p),
      family: general.family,
      primaryBlurb: general.primaryId ? getArchetype(general.primaryId).blurb : null,
      secondaryBlurb: general.runnerUpId ? getArchetype(general.runnerUpId).blurb : null,
      confidence,
      metrics,
      atOrAbove,
    });

    return {
      playerId: p.id,
      pop,
      derived,
      percentiles,
      roles,
      archetypes,
      general,
      summary,
      confidence,
      topArchetype,
      bestRole,
    };
  });
}
