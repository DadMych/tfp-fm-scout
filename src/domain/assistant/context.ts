/**
 * Shared context every rule module runs against (docs/11-assistant-analytics.md §2).
 * Built once per "run smart search" click; everything downstream is a pure read of this.
 */

import type { Formation, Zone } from "../squad/formations.js";
import { deriveSlots, rankFormations, verdictOf, zoneStrengthOf, avgFitOf, type FormationFit, type SlotAssignment, type Verdict } from "./slots.js";
import { solveXI, type PlayerRow, type XiSolution } from "./xi.js";
import { T } from "./thresholds.js";

export type { PlayerRow };

export interface AnalysisContext {
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
  const xi = solveXI(params.squad, params.formation);
  const slots = deriveSlots(xi, params.squad, params.formation);
  const zoneStrength = zoneStrengthOf(slots);
  const avgFit = avgFitOf(slots);
  const starters = new Set([...xi.assignment.values()].map((a) => a.id));
  const bench = params.squad.filter((r) => !starters.has(r.player.id));

  const byId = new Map<string, PlayerRow>();
  for (const r of params.squad) byId.set(r.player.id, r);
  for (const r of params.shortlist) byId.set(r.player.id, r);

  return {
    squad: params.squad,
    shortlist: params.shortlist,
    formation: params.formation,
    budgetCap,
    squadCap,
    xi,
    slots,
    zoneStrength,
    avgFit,
    verdict: verdictOf(avgFit),
    formationRanking: rankFormations(params.squad),
    byId,
    starters,
    bench,
  };
}
