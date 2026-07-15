/**
 * Insight ordering (docs/11 §11.1 + doc 12 §3.5). One place decides what leads the feed
 * and how much of each class is allowed in, so rule modules never reason about relative
 * priority or volume.
 */

import { T } from "./thresholds.js";
import type { Insight, InsightClass, RawInsight, Severity } from "./types.js";

const SEVERITY_BASE: Record<Severity, number> = {
  critical: 1000,
  high: 700,
  medium: 400,
  low: 150,
  praise: 100,
};

const CLASS_BOOST: Partial<Record<InsightClass, number>> = {
  slot: 50,
  chemistry: 40,
  risk: 40,
  age: 25,
  market: 20,
  transfer: 20,
};

/** Max shown per class; classes absent here are bounded naturally by slot/link counts. */
const CLASS_CAP: Partial<Record<InsightClass, number>> = {
  market: T.MARKET_CLASS_CAP,
  transfer: T.TRANSFER_CLASS_CAP,
};

function rulePrefix(id: string): string {
  const i = id.indexOf(":");
  return i === -1 ? id : id.slice(0, i);
}

export function finalize(raw: readonly RawInsight[]): Insight[] {
  const scored: Insight[] = raw.map((r) => ({
    ...r,
    score: SEVERITY_BASE[r.severity] + (CLASS_BOOST[r.cls] ?? 0),
  }));

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  // Subject dedupe (doc 12 §3.5): same rule family + same subjects → keep the best.
  const seen = new Set<string>();
  const deduped = scored.filter((i) => {
    const key = `${rulePrefix(i.id)}|${[...i.subjects].sort().join(",")}`;
    if (i.subjects.length > 0 && seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const classCount = new Map<InsightClass, number>();
  let praiseSeen = 0;
  return deduped.filter((i) => {
    if (i.severity === "praise") {
      praiseSeen += 1;
      if (praiseSeen > T.PRAISE_TOTAL_CAP) return false;
    }
    const cap = CLASS_CAP[i.cls];
    if (cap != null) {
      const n = (classCount.get(i.cls) ?? 0) + 1;
      classCount.set(i.cls, n);
      if (n > cap) return false;
    }
    return true;
  });
}
