/**
 * Front Page story selection (docs/09 §Screens, doc 15 P2).
 * Shared by the React Front Page and the static broadsheet report.
 */

import type { Player } from "./player.js";
import type { PlayerScores } from "./scoring/dataset.js";
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
