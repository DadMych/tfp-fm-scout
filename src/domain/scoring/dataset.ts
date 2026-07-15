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
  /** metric id -> position-group percentile for radar/dossier display. */
  readonly percentiles: Readonly<Record<string, number | null>>;
  /** metric id -> population-wide percentile for archetype gates (doc 06). */
  readonly datasetPercentiles: Readonly<Record<string, number | null>>;
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

  return players.map((p) => {
    const pop: Population = isGoalkeeper(p) ? "gk" : "outfield";
    const derived = derivedByPlayer.get(p.id) as DerivedMetrics;
    const datasetRank = rankers[pop];
    const groupRank = groupRankers.get(primaryGroup(p)) ?? datasetRank;

    const datasetPercentiles: Record<string, number | null> = {};
    const percentiles: Record<string, number | null> = {};
    const atOrAbove: Record<string, number> = {};
    for (const metric of METRIC_IDS) {
      const v = metricValue(p.attrs, derived, metric);
      const dr = datasetRank.get(metric) as Ranker;
      const gr = groupRank.get(metric) as Ranker;
      datasetPercentiles[metric] = v == null ? null : dr.pct(v);
      percentiles[metric] = v == null ? null : gr.pct(v);
      if (v != null) atOrAbove[metric] = dr.atOrAbove(v);
    }

    const ctx = {
      pct: (m: string) => datasetPercentiles[m] ?? null,
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
