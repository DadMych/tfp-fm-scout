import { ATTRIBUTES, type AttributeId } from "../attributes.js";
import { midOf, uncertainty } from "../attr-value.js";
import { computeDerived, type DerivedMetrics, type DerivedId } from "../derived.js";
import { METRIC_IDS, isDerivedId, type MetricId } from "../metric-id.js";
import { makeRanker, type Ranker } from "../percentile.js";
import { canonicalPrimaryGroup, playerGroups, type PositionGroup } from "../positions.js";
import { isGoalkeeper, type Player } from "../player.js";
import { ROLES, type RoleId } from "../roles/registry.js";
import { scoreRole, type RoleScore } from "../roles/score.js";
import {
  scoreAllArchetypes,
  generalArchetype,
  badgeFor,
  type ArchetypeScore,
  type GeneralArchetype,
  type Badge,
} from "../archetypes/score.js";
import { getArchetype, type ArchetypeId } from "../archetypes/registry.js";
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
  /** metric id -> position-group percentile for radar/dossier display. */
  readonly percentiles: Readonly<Partial<Record<MetricId, number | null>>>;
  /** metric id -> population-wide percentile for archetype gates (doc 06). */
  readonly datasetPercentiles: Readonly<Partial<Record<MetricId, number | null>>>;
  readonly roles: Readonly<Partial<Record<RoleId, RoleScore>>>;
  readonly archetypes: readonly ArchetypeScore[];
  readonly general: GeneralArchetype;
  readonly summary: string;
  readonly confidence: number;
  readonly topArchetype: { id: ArchetypeId; score: number; badge: Badge } | null;
  readonly bestRole: { id: RoleId; score: number } | null;
}

const POSITION_GROUPS: readonly PositionGroup[] = ["GK", "CB", "FB/WB", "DM/CM", "AM/W", "ST"];

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

function isDerived(metric: MetricId): metric is DerivedId {
  return isDerivedId(metric);
}

function metricValue(
  attrs: Player["attrs"],
  derived: DerivedMetrics,
  metric: MetricId,
): number | null {
  return isDerived(metric) ? derived[metric] : midOf(attrs, metric);
}

function confidenceFor(attrs: Player["attrs"], expected: readonly AttributeId[]): number {
  if (expected.length === 0) return 0;
  let exact = 0;
  for (const id of expected) if (uncertainty(attrs[id]) === 0) exact += 1;
  return exact / expected.length;
}

function primaryGroup(p: Player): PositionGroup {
  return canonicalPrimaryGroup(p.positions);
}

function inGroup(p: Player, group: PositionGroup): boolean {
  return playerGroups(p.positions).includes(group);
}

function cohortForGroup(players: readonly Player[], group: PositionGroup): Player[] {
  if (group === "GK") return players.filter((p) => isGoalkeeper(p));
  return players.filter((p) => !isGoalkeeper(p) && inGroup(p, group));
}

function buildRankers(
  players: readonly Player[],
  derivedByPlayer: ReadonlyMap<string, DerivedMetrics>,
  cohort: readonly Player[],
): Map<string, Ranker> {
  const map = new Map<string, Ranker>();
  for (const metric of METRIC_IDS) {
    const values = cohort.map((p) =>
      metricValue(p.attrs, derivedByPlayer.get(p.id) as DerivedMetrics, metric),
    );
    map.set(metric, makeRanker(values));
  }
  return map;
}

export function buildScores(players: readonly Player[]): PlayerScores[] {
  const derivedByPlayer = new Map<string, DerivedMetrics>();
  for (const p of players) derivedByPlayer.set(p.id, computeDerived(p.attrs));

  // Rankers per population per metric (whole cohort — archetype gates).
  const rankers: Record<Population, Map<string, Ranker>> = {
    outfield: new Map(),
    gk: new Map(),
  };
  for (const pop of ["outfield", "gk"] as const) {
    const cohort = players.filter((p) => (isGoalkeeper(p) ? pop === "gk" : pop === "outfield"));
    rankers[pop] = buildRankers(players, derivedByPlayer, cohort);
  }

  // Rankers per position group for radar/dossier display percentiles.
  const groupRankers = new Map<PositionGroup, Map<string, Ranker>>();
  for (const group of POSITION_GROUPS) {
    const cohort = cohortForGroup(players, group);
    if (cohort.length === 0) continue;
    groupRankers.set(group, buildRankers(players, derivedByPlayer, cohort));
  }

  // CB ∪ FB/WB cohort for defender-specific archetype gates (doc 17 §7.5).
  const defenderCohort = players.filter(
    (p) => !isGoalkeeper(p) && (inGroup(p, "CB") || inGroup(p, "FB/WB")),
  );
  const defenderRankers =
    defenderCohort.length > 0
      ? buildRankers(players, derivedByPlayer, defenderCohort)
      : null;

  return players.map((p) => {
    const pop: Population = isGoalkeeper(p) ? "gk" : "outfield";
    const derived = derivedByPlayer.get(p.id) as DerivedMetrics;
    const datasetRank = rankers[pop];
    const groupRank = groupRankers.get(primaryGroup(p)) ?? datasetRank;

    const datasetPercentiles: Partial<Record<MetricId, number | null>> = {};
    const percentiles: Partial<Record<MetricId, number | null>> = {};
    const atOrAbove: Partial<Record<MetricId, number>> = {};
    for (const metric of METRIC_IDS) {
      const v = metricValue(p.attrs, derived, metric);
      const dr = datasetRank.get(metric) as Ranker;
      const gr = groupRank.get(metric) as Ranker;
      datasetPercentiles[metric] = v == null ? null : dr.pct(v);
      percentiles[metric] = v == null ? null : gr.pct(v);
      if (v != null) atOrAbove[metric] = gr.atOrAbove(v);
    }

    const ctx = {
      pct: (m: MetricId) => datasetPercentiles[m] ?? null,
      raw: (m: MetricId) => metricValue(p.attrs, derived, m),
      cohortPct: (cohort: "defenders", m: MetricId) => {
        if (cohort !== "defenders" || !defenderRankers) return null;
        const v = metricValue(p.attrs, derived, m);
        if (v == null) return null;
        return defenderRankers.get(m)!.pct(v);
      },
    };

    // Roles: score all; best role prefers ones playable in the player's positions.
    const roles: Partial<Record<RoleId, RoleScore>> = {};
    for (const role of ROLES) roles[role.id] = scoreRole(p.attrs, role);
    const posSet = new Set(p.positions);
    let bestRole: PlayerScores["bestRole"] = null;
    let bestEligible = -1;
    let bestAny = -1;
    let bestAnyId: RoleId | "" = "";
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

    // Top archetype: highest gate-passing score ≥ 60, else null (doc 06 §4).
    const passing = archetypes.filter((a) => a.gatesPassed && a.score >= 60).sort((a, b) => b.score - a.score);
    const top = passing[0];
    const topArchetype: PlayerScores["topArchetype"] = top
      ? { id: top.id, score: top.score, badge: badgeFor(top.score, top.gatesPassed) }
      : null;

    const confidence = confidenceFor(p.attrs, pop === "gk" ? GK_EXPECTED : OUTFIELD_EXPECTED);

    const metrics: SummaryMetric[] = [];
    for (const metric of METRIC_IDS) {
      const pctv = percentiles[metric];
      if (pctv != null) metrics.push({ metric, pct: pctv });
    }
    const primaryDef = general.primaryId ? getArchetype(general.primaryId) : null;
    const profileMetrics = primaryDef
      ? [...primaryDef.core, ...primaryDef.major, ...primaryDef.minor]
      : undefined;
    const summary = generateSummary({
      age: p.age,
      positionGroup: primaryGroup(p),
      family: general.family,
      primaryBlurb: primaryDef?.blurb ?? null,
      secondaryBlurb: general.runnerUpId ? getArchetype(general.runnerUpId).blurb : null,
      confidence,
      metrics,
      atOrAbove,
      ...(profileMetrics ? { profileMetrics } : {}),
    });

    return {
      playerId: p.id,
      pop,
      derived,
      percentiles,
      datasetPercentiles,
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
