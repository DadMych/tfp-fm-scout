/**
 * Scout recommendations (docs/08 — the "guide" layer).
 *
 * Turns raw scores into an opinion: a single verdict plus the reasoning behind it, the way a
 * head scout would brief a manager. Squad-aware — when the user's own squad is loaded we can
 * say "this beats your best centre-back", not just "good centre-back". Pure and deterministic.
 */

import type { Player } from "./player.js";
import type { PlayerScores } from "./scoring/dataset.js";
import { DEFAULT_FORMATION_ID } from "./assistant/defaults.js";
import { bestPairFitForGroup, type PlayerRow } from "./assistant/xi.js";
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
 * Uses preset pairFit under the active formation — the same currency as the Fit column.
 */
export interface SquadContext {
  readonly formationId: string;
  /** Best pairFit already available per position group. */
  readonly bestByGroup: Readonly<Partial<Record<PositionGroup, number>>>;
}

const TONE: Record<Verdict, Tone> = {
  "Priority target": "gold",
  "Squad upgrade": "gold",
  Bargain: "ink",
  "One for the future": "ink",
  "Proven performer": "ink",
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
  formationId: string = DEFAULT_FORMATION_ID,
): SquadContext {
  const byId = new Map(scores.map((s) => [s.playerId, s]));
  const bestByGroup: Partial<Record<PositionGroup, number>> = {};
  for (const p of players) {
    const s = byId.get(p.id);
    if (!s) continue;
    const row: PlayerRow = { player: p, scores: s };
    for (const g of playerGroups(p.positions)) {
      const fit = bestPairFitForGroup(row, formationId, g);
      if (fit > (bestByGroup[g] ?? -1)) bestByGroup[g] = fit;
    }
  }
  return { formationId, bestByGroup };
}

function rowFor(p: Player, s: PlayerScores): PlayerRow {
  return { player: p, scores: s };
}

function fitInGroup(p: Player, s: PlayerScores, ctx: SquadContext, group: PositionGroup): number {
  return bestPairFitForGroup(rowFor(p, s), ctx.formationId, group);
}

function valueMillions(p: Player): number | null {
  return p.value != null && p.value > 0 ? p.value / 1e6 : null;
}

interface MarginInfo {
  readonly group: PositionGroup;
  readonly margin: number;
  readonly best: number;
  readonly empty: boolean;
}

/** Best margin across the player's position groups (negative margins included). */
function bestMargin(
  p: Player,
  s: PlayerScores,
  ctx: SquadContext | undefined,
): MarginInfo | null {
  if (!ctx) return null;
  let best: MarginInfo | null = null;
  for (const g of playerGroups(p.positions)) {
    const cur = ctx.bestByGroup[g];
    const empty = cur == null;
    const incumbent = cur ?? 0;
    const fit = fitInGroup(p, s, ctx, g);
    const margin = fit - incumbent;
    if (!best || margin > best.margin) {
      best = { group: g, margin, best: incumbent, empty };
    }
  }
  return best;
}

/** Best squad group the player could slot into, with the margin he'd add (or null). */
function upgradeOver(
  p: Player,
  s: PlayerScores,
  ctx: SquadContext | undefined,
): { group: PositionGroup; margin: number; best: number; empty: boolean } | null {
  const m = bestMargin(p, s, ctx);
  if (!m || m.margin < 5) return null;
  return m;
}

function cascadeVerdict(x: {
  score: number;
  age: number | null;
  perM: number | null;
}): Verdict {
  const { score, age, perM } = x;
  if (perM != null && perM >= 6 && score >= 65) return "Bargain";
  if (age != null && age <= 20 && score >= 68) return "One for the future";
  if (score >= 75) return "Proven performer";
  if (score >= 58) return "Squad depth";
  if (age != null && age <= 22) return "Project";
  return "Squad depth";
}

function wouldBePriorityTarget(x: {
  score: number;
  badge: Badge;
  conf: number;
}): boolean {
  return (x.badge === "Elite" || x.score >= 85) && x.conf >= 45;
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
  const margin = bestMargin(p, s, ctx);
  const upgrade = upgradeOver(p, s, ctx);
  const hasSquad = ctx != null;

  const reasons: string[] = [];
  if (badge) reasons.push(`${badge} ${archName} — score ${score} in this database`);
  else reasons.push(`${archName}, score ${score}`);
  if (upgrade) {
    reasons.push(
      upgrade.empty
        ? `Would fill your ${upgrade.group} slot — you have no natural cover`
        : `Would be your best ${upgrade.group} (beats your current ${Math.round(upgrade.best)} by ${Math.round(upgrade.margin)})`,
    );
  }
  if (age != null && age <= 20) reasons.push(`Only ${age} — room to develop`);
  else if (age != null && age >= 31) reasons.push(`Age ${age} — a short-term option`);
  if (vm != null) {
    const money = vm >= 1 ? `€${round1(vm)}M` : `€${Math.round(vm * 1000)}K`;
    reasons.push(perM != null && perM >= 6 ? `Strong value at ${money}` : `Valued at ${money}`);
  }
  if (conf < 45) reasons.push(`Only ${conf}% scouted — treat with caution`);

  const verdict = decideVerdict({ score, badge, age, perM, conf, upgrade, margin, hasSquad });
  const demotedElite =
    hasSquad &&
    margin != null &&
    margin.margin <= 0 &&
    wouldBePriorityTarget({ score, badge, conf });
  const rentalHeadline = age != null && age >= 33 && (badge === "Elite" || score >= 85);

  return {
    verdict,
    tone: TONE[verdict],
    headline: headlineFor(verdict, {
      archName,
      score,
      age,
      upgrade,
      vm,
      perM,
      demotedElite,
      rentalHeadline,
      margin,
    }),
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
  upgrade: { group: PositionGroup; margin: number; best: number; empty: boolean } | null;
  margin: MarginInfo | null;
  hasSquad: boolean;
}): Verdict {
  const { score, badge, age, perM, upgrade, margin, hasSquad, conf } = x;

  if (score < 50) return "Not for us";

  // §2: veterans — no squad-upgrade or priority-target calls.
  if (age != null && age >= 33) {
    return cascadeVerdict({ score, age, perM });
  }

  // §1: covered squad — he does not beat any incumbent.
  if (hasSquad && margin != null && margin.margin <= 0) {
    return cascadeVerdict({ score, age, perM });
  }

  // §1: marginal improvement — at most proven performer.
  if (hasSquad && margin != null && margin.margin > 0 && margin.margin < 5) {
    return cascadeVerdict({ score, age, perM });
  }

  // §8.3: low-confidence players cannot carry a squad-upgrade call.
  if (upgrade && score >= 65) {
    if (conf >= 45) return "Squad upgrade";
    return cascadeVerdict({ score, age, perM });
  }

  // §2: 31–32 — priority only when the fee earns it.
  if (age != null && age >= 31 && age <= 32) {
    if (wouldBePriorityTarget({ score, badge, conf }) && perM != null && perM >= 6) {
      return "Priority target";
    }
    if (wouldBePriorityTarget({ score, badge, conf })) {
      return cascadeVerdict({ score, age, perM });
    }
  }

  if (wouldBePriorityTarget({ score, badge, conf })) return "Priority target";
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
    upgrade: { group: PositionGroup; margin: number; best: number; empty: boolean } | null;
    vm: number | null;
    perM: number | null;
    demotedElite: boolean;
    rentalHeadline: boolean;
    margin: MarginInfo | null;
  },
): string {
  if (x.rentalHeadline && verdict === "Proven performer") {
    return `Elite today at ${x.age} — a one-season rental, price accordingly.`;
  }
  if (x.demotedElite && x.margin) {
    return `Elite ${x.archName.toLowerCase()} — but ${x.margin.group} is already covered; a luxury, not a need.`;
  }

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
