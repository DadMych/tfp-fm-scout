/**
 * Similar-player search (doc 08 §4): cosine similarity on derived percentiles + archetype shape.
 */

import { DERIVED_INPUTS, type DerivedId } from "../derived.js";
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
  const archId = scores.topArchetype?.id;
  const archMetrics = archId ? weightedMetrics(getArchetype(archId)) : [];
  const metrics = [...DERIVED_IDS, ...archMetrics.filter((m) => !DERIVED_IDS.includes(m as DerivedId))];
  return metrics.map((metric) => ({
    metric,
    value: scores.percentiles[metric] ?? 0,
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

export function findSimilar(params: {
  readonly anchor: PlayerRow;
  readonly pool: readonly PlayerRow[];
  readonly sameGroup?: boolean;
  readonly limit?: number;
}): SimilarHit[] {
  const anchorVec = similarVector(params.anchor.scores);
  const anchorGroups = new Set(playerGroups(params.anchor.player.positions));
  const limit = params.limit ?? 20;

  const hits: SimilarHit[] = [];
  for (const row of params.pool) {
    if (row.player.id === params.anchor.player.id) continue;
    if (params.sameGroup !== false) {
      const groups = playerGroups(row.player.positions);
      if (!groups.some((g) => anchorGroups.has(g))) continue;
    }
    const vec = similarVector(row.scores);
    if (vec.length !== anchorVec.length) continue;
    const similarity = cosine(anchorVec, vec);
    hits.push({
      playerId: row.player.id,
      name: row.player.name,
      similarity: Math.round(similarity * 100),
      age: row.player.age ?? null,
      value: row.player.value ?? null,
    });
  }

  return hits.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}
