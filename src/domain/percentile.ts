/**
 * Percentile ranking within a dataset (docs/04-data-model.md §4).
 *
 * Mid-rank definition: percentile = (count strictly below + half of ties) / n × 100.
 * This is stable under duplication of the whole population (the invariance property
 * asserted in docs/06-archetypes.md §7).
 */

/** Percentile (0–100) of `value` within `population`. Nulls in the population are ignored. */
export function percentileRank(
  population: readonly (number | null)[],
  value: number,
): number {
  let below = 0;
  let equal = 0;
  let n = 0;
  for (const p of population) {
    if (p == null) continue;
    n += 1;
    if (p < value) below += 1;
    else if (p === value) equal += 1;
  }
  if (n === 0) return 0;
  return ((below + equal / 2) / n) * 100;
}

/**
 * Percentiles for every value in `values`, ranked against the same set.
 * Nulls map to null (a masked value has no percentile).
 */
export function percentilesOf(
  values: readonly (number | null)[],
): (number | null)[] {
  return values.map((v) => (v == null ? null : percentileRank(values, v)));
}

/** First index whose element is >= `v` (lower bound) in an ascending array. */
function lowerBound(sorted: readonly number[], v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] as number) < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose element is > `v` (upper bound) in an ascending array. */
function upperBound(sorted: readonly number[], v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] as number) <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * A ranker prepared once over a population (sorts internally), giving O(log n) lookups.
 * Use this instead of `percentileRank` when ranking many values against the same set
 * (e.g. every player in a 20k-row dataset — avoids O(n²)).
 */
export interface Ranker {
  readonly n: number;
  /** Mid-rank percentile (0–100) of `v`. */
  pct(v: number): number;
  /** Count of population members with value >= `v` (for "one of the N best" claims). */
  atOrAbove(v: number): number;
}

export function makeRanker(population: readonly (number | null)[]): Ranker {
  const sorted = population.filter((x): x is number => x != null).sort((a, b) => a - b);
  const n = sorted.length;
  return {
    n,
    pct(v) {
      if (n === 0) return 0;
      const below = lowerBound(sorted, v);
      const notAbove = upperBound(sorted, v);
      const equal = notAbove - below;
      return ((below + equal / 2) / n) * 100;
    },
    atOrAbove(v) {
      if (n === 0) return 0;
      return n - lowerBound(sorted, v);
    },
  };
}
