/**
 * Scout recommendations (docs/08 — the "guide" layer).
 *
 * Turns raw scores into an opinion: a single verdict plus the reasoning behind it, the way a
 * head scout would brief a manager. Squad-aware — when the user's own squad is loaded we can
 * say "this beats your best centre-back", not just "good centre-back". Pure and deterministic.
 */

import type { Player } from "./player.js";
import type { PlayerScores } from "./scoring/dataset.js";
import { playerGroups, type PositionGroup } from "./positions.js";
import { getArchetype } from "./archetypes/registry.js";
import type { Badge } from "./archetypes/score.js";

export type Verdict =
  | "Priority target"
  | "Squad upgrade"
  | "Bargain"
  | "One for the future"
  | "Proven performer"
  | "Squad depth"
  | "Project"
  | "Not for us";

export type Tone = "gold" | "green" | "ink" | "muted";

export interface Recommendation {
  readonly verdict: Verdict;
  readonly tone: Tone;
  /** One-sentence brief. */
  readonly headline: string;
  /** Supporting bullet points (most important first). */
  readonly reasons: readonly string[];
  /** Sort key — lower is a stronger recommendation (drives "best first" ordering). */
  readonly rank: number;
}

/**
 * What the user's own squad looks like, so shortlist players can be judged against it.
 * Keyed on best-role fit (absolute, 0–100 from attribute midpoints) rather than the
 * archetype score, because archetype scores are percentiles *within a dataset* and so are
 * not comparable between the squad and the shortlist. Role fit is comparable.
 */
export interface SquadContext {
  /** Best best-role fit already available per position group. */
  readonly bestByGroup: Readonly<Partial<Record<PositionGroup, number>>>;
}

const TONE: Record<Verdict, Tone> = {
  "Priority target": "gold",
  "Squad upgrade": "gold",
  Bargain: "green",
  "One for the future": "green",
  "Proven performer": "green",
  "Squad depth": "ink",
  Project: "ink",
  "Not for us": "muted",
};

const RANK: Record<Verdict, number> = {
  "Priority target": 0,
  "Squad upgrade": 1,
  Bargain: 2,
  "One for the future": 3,
  "Proven performer": 4,
  "Squad depth": 5,
  Project: 6,
  "Not for us": 7,
};

/** Build squad context from the user's squad (players + their in-squad scores). */
export function buildSquadContext(
  players: readonly Player[],
  scores: readonly PlayerScores[],
): SquadContext {
  const byId = new Map(scores.map((s) => [s.playerId, s]));
  const bestByGroup: Partial<Record<PositionGroup, number>> = {};
  for (const p of players) {
    const s = byId.get(p.id);
    if (!s) continue;
    const fit = s.bestRole?.score ?? 0;
    for (const g of playerGroups(p.positions)) {
      if (fit > (bestByGroup[g] ?? -1)) bestByGroup[g] = fit;
    }
  }
  return { bestByGroup };
}

function valueMillions(p: Player): number | null {
  return p.value != null && p.value > 0 ? p.value / 1e6 : null;
}

/** Best squad group the player could slot into, with the margin he'd add (or null). */
function upgradeOver(
  p: Player,
  roleFit: number,
  ctx: SquadContext | undefined,
): { group: PositionGroup; margin: number; best: number } | null {
  if (!ctx) return null;
  let best: { group: PositionGroup; margin: number; best: number } | null = null;
  for (const g of playerGroups(p.positions)) {
    const cur = ctx.bestByGroup[g];
    if (cur == null) continue;
    const margin = roleFit - cur;
    if (margin >= 5 && (!best || margin > best.margin)) {
      best = { group: g, margin, best: cur };
    }
  }
  return best;
}

export function recommend(
  p: Player,
  s: PlayerScores,
  ctx?: SquadContext,
): Recommendation {
  const score = Math.round(s.topArchetype?.score ?? 0);
  const badge = s.topArchetype?.badge ?? null;
  const arch = s.topArchetype ? getArchetype(s.topArchetype.id) : null;
  const archName = arch?.name ?? "utility profile";
  const age = p.age;
  const vm = valueMillions(p);
  const perM = vm != null && vm > 0 ? score / vm : null;
  const conf = Math.round(s.confidence * 100);
  const roleFit = s.bestRole?.score ?? 0;
  const upgrade = upgradeOver(p, roleFit, ctx);

  const reasons: string[] = [];
  if (badge) reasons.push(`${badge} ${archName} — score ${score} in this database`);
  else reasons.push(`${archName}, score ${score}`);
  if (upgrade) {
    reasons.push(
      `Would be your best ${upgrade.group} (beats your current ${Math.round(upgrade.best)} by ${Math.round(upgrade.margin)})`,
    );
  }
  if (age != null && age <= 20) reasons.push(`Only ${age} — room to develop`);
  else if (age != null && age >= 31) reasons.push(`Age ${age} — a short-term option`);
  if (vm != null) {
    const money = vm >= 1 ? `€${round1(vm)}M` : `€${Math.round(vm * 1000)}K`;
    reasons.push(perM != null && perM >= 6 ? `Strong value at ${money}` : `Valued at ${money}`);
  }
  if (conf < 45) reasons.push(`Only ${conf}% scouted — treat with caution`);

  const verdict = decideVerdict({ score, badge, age, perM, conf, upgrade });
  return {
    verdict,
    tone: TONE[verdict],
    headline: headlineFor(verdict, { archName, score, age, upgrade, vm, perM }),
    reasons,
    rank: RANK[verdict],
  };
}

function decideVerdict(x: {
  score: number;
  badge: Badge;
  age: number | null;
  perM: number | null;
  conf: number;
  upgrade: { group: PositionGroup; margin: number; best: number } | null;
}): Verdict {
  const { score, badge, age, perM, upgrade } = x;

  if (score < 50) return "Not for us";
  // A concrete, quantified squad improvement is the most actionable call we can make.
  if (upgrade && score >= 65) return "Squad upgrade";
  if ((badge === "Elite" || score >= 85) && x.conf >= 45) return "Priority target";
  if (perM != null && perM >= 6 && score >= 65) return "Bargain";
  if (age != null && age <= 20 && score >= 68) return "One for the future";
  if (age != null && age >= 24 && age <= 30 && score >= 75) return "Proven performer";
  if (score >= 58) return "Squad depth";
  if (age != null && age <= 22) return "Project";
  return "Squad depth";
}

function headlineFor(
  verdict: Verdict,
  x: {
    archName: string;
    score: number;
    age: number | null;
    upgrade: { group: PositionGroup; margin: number; best: number } | null;
    vm: number | null;
    perM: number | null;
  },
): string {
  const money = x.vm != null ? (x.vm >= 1 ? `€${round1(x.vm)}M` : `€${Math.round(x.vm * 1000)}K`) : null;
  switch (verdict) {
    case "Priority target":
      return `Go get him — an elite ${x.archName.toLowerCase()} at the top of this database.`;
    case "Squad upgrade":
      return x.upgrade
        ? `A ready-made upgrade for your ${x.upgrade.group} — worth a firm move.`
        : `A ready-made upgrade for your squad.`;
    case "Bargain":
      return money
        ? `Outstanding value: ${x.archName.toLowerCase()} quality for ${money}.`
        : `Outstanding value for the level.`;
    case "One for the future":
      return `A genuine prospect — ${x.age} years old with a real ceiling.`;
    case "Proven performer":
      return `A dependable ${x.archName.toLowerCase()} in his prime.`;
    case "Squad depth":
      return `Useful depth — rotation quality rather than a starter.`;
    case "Project":
      return `Raw but young — a developmental punt, not an immediate fix.`;
    case "Not for us":
      return `Below the level we'd recommend pursuing.`;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
