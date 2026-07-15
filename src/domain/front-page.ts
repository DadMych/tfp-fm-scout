/**
 * Front Page story selection (docs/09 §Screens, doc 15 P2).
 * Shared by the React Front Page and the static broadsheet report.
 */

import type { Player } from "./player.js";
import type { PlayerScores } from "./scoring/dataset.js";
import type { Recommendation } from "./recommendation.js";
import { metricLabel } from "../report/format.js";

export interface ScoredRow {
  readonly p: Player;
  readonly s: PlayerScores;
}

export function standouts(
  s: PlayerScores,
  n = 3,
): readonly { readonly label: string; readonly pct: number; readonly metric: string }[] {
  return Object.entries(s.percentiles)
    .filter((e): e is [string, number] => e[1] != null)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([metric, pct]) => ({ metric, pct, label: metricLabel(metric) }));
}

/** Youngest Elite with ≥50% known attrs; else highest top-archetype score. */
export function pickLead(rows: readonly ScoredRow[]): ScoredRow | null {
  if (rows.length === 0) return null;
  const known = rows.filter((r) => r.s.confidence >= 0.5);
  const pool = known.length ? known : [...rows];
  const elite = pool.filter((r) => r.s.topArchetype?.badge === "Elite" && r.p.age != null);
  if (elite.length) {
    return [...elite].sort((a, b) => (a.p.age as number) - (b.p.age as number))[0]!;
  }
  return [...pool].sort(
    (a, b) => (b.s.topArchetype?.score ?? 0) - (a.s.topArchetype?.score ?? 0),
  )[0]!;
}

/** Best score-per-euro among quality known players with a real fee. */
export function pickBargain(
  rows: readonly ScoredRow[],
): (ScoredRow & { readonly perM: number }) | null {
  let best: (ScoredRow & { perM: number }) | null = null;
  for (const r of rows) {
    const v = r.p.value;
    const score = r.s.topArchetype?.score ?? 0;
    if (v == null || v < 1e6 || score < 65 || r.s.confidence < 0.5) continue;
    const perM = score / (v / 1e6);
    if (!best || perM > best.perM) best = { ...r, perM };
  }
  return best;
}

export function posLabel(p: Player): string {
  return p.positions.length ? p.positions.join("/") : "—";
}

/** Prose clause for the top standout percentile (doc 19 §1). */
export function standoutClause(s: PlayerScores): string | null {
  const top = standouts(s, 1)[0];
  if (!top || top.pct < 70) return null;
  return `${Math.round(top.pct)}th percentile for ${top.label.toLowerCase()} in this database.`;
}

export interface BriefRow extends ScoredRow {
  readonly rec: Recommendation;
}

/** Diversify brief picks — at most two per verdict tone (doc 19 §1). */
export function pickBriefs(rows: readonly BriefRow[], limit = 4): BriefRow[] {
  const sorted = [...rows].sort(
    (a, b) => a.rec.rank - b.rec.rank || (b.s.topArchetype?.score ?? 0) - (a.s.topArchetype?.score ?? 0),
  );
  const toneCount = new Map<string, number>();
  const out: BriefRow[] = [];
  for (const row of sorted) {
    if (row.rec.verdict === "Not for us") continue;
    const n = toneCount.get(row.rec.tone) ?? 0;
    if (n >= 2) continue;
    toneCount.set(row.rec.tone, n + 1);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}
