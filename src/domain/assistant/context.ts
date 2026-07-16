/**
 * Shared context every rule module runs against (docs/11-assistant-analytics.md §2).
 * Built once per "run smart search" click; everything downstream is a pure read of this.
 */

import type { Formation, Zone } from "../squad/formations.js";
import { isLoanedIn, isLoanedOut, ourClubOf, seasonEndOf } from "../squad/status.js";
import { deriveSlots, rankFormations, verdictOf, zoneStrengthOf, avgFitOf, type FormationFit, type SlotAssignment, type Verdict } from "./slots.js";
import { solveXI, type PlayerRow, type XiSolution } from "./xi.js";
import { T } from "./thresholds.js";

export type { PlayerRow };

export interface AnalysisContext {
  /** Players actually available this season — excludes anyone already loaned out. */
  readonly squad: readonly PlayerRow[];
  readonly shortlist: readonly PlayerRow[];
  readonly formation: Formation;
  readonly budgetCap: number;
  /** Registered-squad ceiling after the window (doc 20). */
  readonly squadCap: number;
  readonly xi: XiSolution;
  readonly slots: readonly SlotAssignment[];
  readonly zoneStrength: Readonly<Record<Zone, number>>;
  readonly avgFit: number;
  readonly verdict: Verdict;
  readonly formationRanking: readonly FormationFit[];
  readonly byId: ReadonlyMap<string, PlayerRow>;
  readonly starters: ReadonlySet<string>;
  readonly bench: readonly PlayerRow[];
  /** Our club name inferred from the export (doc 22). */
  readonly ourClub: string | null;
  /** ISO date of the June 30 ending the current season, or null when unknown. */
  readonly seasonEnd: string | null;
  /** Ids of players here on loan from another club — not ours to sell or re-loan. */
  readonly loanedIn: ReadonlySet<string>;
  /** Our players currently away on loan — in the export but unavailable this season. */
  readonly loanedOut: readonly PlayerRow[];
}

export interface ContextParams {
  readonly squad: readonly PlayerRow[];
  readonly shortlist: readonly PlayerRow[];
  readonly formation: Formation;
  readonly budget: number;
  readonly useFullBudget: boolean;
  readonly squadCap?: number | undefined;
}

export function buildContext(params: ContextParams): AnalysisContext {
  const budgetCap = params.useFullBudget ? params.budget : Math.round(params.budget * 0.8);
  const squadCap = Math.max(11, Math.round(params.squadCap ?? T.SQUAD_CAP));

  // Players away on loan are in the export but can't play or be picked this season —
  // analyse the squad without them (doc 22 §2).
  const allPlayers = params.squad.map((r) => r.player);
  const ourClub = ourClubOf(allPlayers);
  const seasonEnd = seasonEndOf(allPlayers);
  const loanedOut = params.squad.filter((r) => isLoanedOut(r.player, ourClub));
  const loanedOutIds = new Set(loanedOut.map((r) => r.player.id));
  const squad = params.squad.filter((r) => !loanedOutIds.has(r.player.id));
  const loanedIn = new Set(
    squad.filter((r) => isLoanedIn(r.player, ourClub)).map((r) => r.player.id),
  );

  const xi = solveXI(squad, params.formation);
  const slots = deriveSlots(xi, squad, params.formation);
  const zoneStrength = zoneStrengthOf(slots);
  const avgFit = avgFitOf(slots);
  const starters = new Set([...xi.assignment.values()].map((a) => a.id));
  const bench = squad.filter((r) => !starters.has(r.player.id));

  const byId = new Map<string, PlayerRow>();
  for (const r of params.squad) byId.set(r.player.id, r);
  for (const r of params.shortlist) byId.set(r.player.id, r);

  return {
    squad,
    shortlist: params.shortlist,
    formation: params.formation,
    budgetCap,
    squadCap,
    xi,
    slots,
    zoneStrength,
    avgFit,
    verdict: verdictOf(avgFit),
    formationRanking: rankFormations(squad),
    byId,
    starters,
    bench,
    ourClub,
    seasonEnd,
    loanedIn,
    loanedOut,
  };
}
