/**
 * Archetype-relevant evidence selection (doc 17 §4).
 * One function for pull-quote metric picking across dossier, broadsheet, and UI.
 */

import { getArchetype, type ArchetypeId } from "./archetypes/registry.js";
import { isValidMetric, type MetricId } from "./metric-id.js";
import type { PlayerScores } from "./scoring/dataset.js";
import { metricLabel, ordinal } from "../report/format.js";

const RELEVANT_MIN_PCT = 70;

function metricWeight(archetypeId: ArchetypeId | null, metric: MetricId): number {
  if (!archetypeId) return 0;
  const def = getArchetype(archetypeId);
  const core = def.core as readonly MetricId[];
  const major = def.major as readonly MetricId[];
  const minor = def.minor as readonly MetricId[];
  if (core.includes(metric)) return 3;
  if (major.includes(metric)) return 2;
  if (minor.includes(metric)) return 1;
  return 0;
}

/** Best metric for a pull-quote, weighted by archetype relevance. */
export function pullQuoteMetric(s: PlayerScores): { metric: MetricId; pct: number } | null {
  const archetypeId = s.topArchetype?.id ?? null;
  const candidates = Object.entries(s.percentiles)
    .filter((e): e is [MetricId, number] => isValidMetric(e[0]) && e[1] != null)
    .map(([metric, pct]) => ({ metric, pct, weight: metricWeight(archetypeId, metric) }));

  if (candidates.length === 0) return null;

  const relevant = candidates.filter((c) => c.weight > 0 && c.pct >= RELEVANT_MIN_PCT);
  const pool = relevant.length > 0 ? relevant : candidates;
  pool.sort((a, b) => b.weight - a.weight || b.pct - a.pct);
  const top = pool[0]!;
  return { metric: top.metric, pct: top.pct };
}

export function formatPullQuote(s: PlayerScores): string {
  const top = pullQuoteMetric(s);
  if (!top) return "";
  return `In this database he sits in the ${ordinal(Math.round(top.pct))} percentile for ${metricLabel(top.metric).toLowerCase()}.`;
}
