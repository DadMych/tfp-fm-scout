/**
 * Similar-player search (doc 08 §4): cosine similarity on derived percentiles + archetype shape.
 */

import { DERIVED_INPUTS, type DerivedId } from "../derived.js";
import { percentileFor } from "../metric-id.js";
import { getArchetype } from "../archetypes/registry.js";
import type { ArchetypeDef } from "../archetypes/registry.js";
import { playerGroups } from "../positions.js";
import type { PlayerScores } from "../scoring/dataset.js";
import type { PlayerRow } from "../assistant/xi.js";

const DERIVED_IDS = Object.keys(DERIVED_INPUTS) as DerivedId[];

function weightedMetrics(arch: ArchetypeDef): readonly string[] {
  const ranked: { metric: string; weight: number }[] = [];
  for (const metric of arch.core) ranked.push({ metric, weight: 3 });
  for (const metric of arch.major) ranked.push({ metric, weight: 2 });
  for (const metric of arch.minor) ranked.push({ metric, weight: 1 });
  ranked.sort((a, b) => b.weight - a.weight || a.metric.localeCompare(b.metric));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of ranked) {
    if (seen.has(entry.metric)) continue;
    seen.add(entry.metric);
    out.push(entry.metric);
    if (out.length >= 10) break;
  }
  return out;
}

export function similarVector(scores: PlayerScores): readonly { metric: string; value: number }[] {
  return vectorForMetrics(scores, metricListFor(scores));
}

function metricListFor(scores: PlayerScores): readonly string[] {
  const archId = scores.topArchetype?.id ?? scores.general.primaryId;
  const archMetrics = archId ? weightedMetrics(getArchetype(archId)) : [];
  return [...DERIVED_IDS, ...archMetrics.filter((m) => !DERIVED_IDS.includes(m as DerivedId))];
}

function vectorForMetrics(
  scores: PlayerScores,
  metrics: readonly string[],
): readonly { metric: string; value: number }[] {
  return metrics.map((metric) => ({
    metric,
    value: percentileFor(scores.percentiles, metric) ?? 0,
  }));
}

function cosine(
  a: readonly { value: number }[],
  b: readonly { value: number }[],
): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!.value;
    const y = b[i]!.value;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface SimilarHit {
  readonly playerId: string;
  readonly name: string;
  readonly similarity: number;
  readonly age: number | null;
  readonly value: number | null;
}

function vectorDistance(
  a: readonly { value: number }[],
  b: readonly { value: number }[],
): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i]!.value - b[i]!.value) ** 2;
  return Math.sqrt(sum);
}

export function findSimilar(params: {
  readonly anchor: PlayerRow;
  readonly pool: readonly PlayerRow[];
  readonly sameGroup?: boolean;
  readonly limit?: number;
}): SimilarHit[] {
  const anchorMetrics = metricListFor(params.anchor.scores);
  const anchorVec = vectorForMetrics(params.anchor.scores, anchorMetrics);
  const anchorGroups = new Set(playerGroups(params.anchor.player.positions));
  const limit = params.limit ?? 20;

  const hits: { hit: SimilarHit; distance: number }[] = [];
  for (const row of params.pool) {
    if (row.player.id === params.anchor.player.id) continue;
    if (params.sameGroup !== false) {
      const groups = playerGroups(row.player.positions);
      if (!groups.some((g) => anchorGroups.has(g))) continue;
    }
    const vec = vectorForMetrics(row.scores, anchorMetrics);
    if (vec.length !== anchorVec.length) continue;
    const similarity = cosine(anchorVec, vec);
    hits.push({
      hit: {
        playerId: row.player.id,
        name: row.player.name,
        similarity: Math.round(similarity * 100),
        age: row.player.age ?? null,
        value: row.player.value ?? null,
      },
      distance: vectorDistance(anchorVec, vec),
    });
  }

  return hits
    .sort((a, b) => b.hit.similarity - a.hit.similarity || a.distance - b.distance)
    .map((x) => x.hit)
    .slice(0, limit);
}
