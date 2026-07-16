/**
 * buildAssistantReport — the single entry point the UI touches (docs/11 §2, §11.3).
 */

import { buildContext, type ContextParams } from "./context.js";
import { evaluateLinks } from "./links.js";
import { buildPackages } from "./packages.js";
import { finalize } from "./priority.js";
import { buildTeamReport } from "./team-report.js";
import { buildTacticBrief } from "./tactic-brief.js";
import { buildBoard } from "./transfers/board.js";
import type { AssistantReport, RawInsight } from "./types.js";

import * as shape from "./rules/shape.js";
import * as slot from "./rules/slot.js";
import * as age from "./rules/age.js";
import * as dna from "./rules/dna.js";
import * as physical from "./rules/physical.js";
import * as setpiece from "./rules/setpiece.js";
import * as chemistry from "./rules/chemistry.js";
import * as contracts from "./rules/contracts.js";
import * as market from "./rules/market.js";
import * as development from "./rules/development.js";
import * as risk from "./rules/risk.js";
import * as shortlist from "./rules/shortlist.js";
import * as transfer from "./rules/transfer.js";

export type { ContextParams };

export function buildAssistantReport(params: ContextParams): AssistantReport {
  const ctx = buildContext(params);
  const linkBoard = evaluateLinks(ctx);
  const board = buildBoard(ctx);

  // Packages consume the ids of slot-level findings (their `solves` field), and the
  // risk/transfer rules consume the packages — hence the two-stage rule run.
  const preRaw: RawInsight[] = [
    ...shape.run(ctx),
    ...slot.run(ctx),
    ...age.run(ctx),
    ...dna.run(ctx),
    ...physical.run(ctx),
    ...setpiece.run(ctx),
    ...chemistry.run(ctx, linkBoard),
    ...contracts.run(ctx),
    ...market.run(ctx),
    ...development.run(ctx),
    ...shortlist.run(ctx),
  ];
  const packages = buildPackages(ctx, preRaw.map((i) => i.id));
  const headroom = market.headroomInsight(ctx, packages);

  const raw: RawInsight[] = [
    ...preRaw,
    ...(headroom ? [headroom] : []),
    ...risk.run(ctx, packages),
    ...transfer.run(ctx, board, packages),
  ];
  const insights = finalize(raw);
  const teamReport = buildTeamReport(ctx, insights, packages);
  const tacticBrief = buildTacticBrief(ctx, linkBoard);

  return {
    formation: ctx.formation,
    xi: ctx.xi,
    slots: ctx.slots,
    zoneStrength: ctx.zoneStrength,
    avgFit: ctx.avgFit,
    verdict: ctx.verdict,
    formationRanking: ctx.formationRanking,
    linkBoard,
    insights,
    packages,
    teamReport,
    budgetCap: ctx.budgetCap,
    board,
    styleReads: tacticBrief.styleReads,
    tacticBrief,
  };
}

export type { AssistantReport } from "./types.js";
export type { PlayerRow } from "./xi.js";
