/**
 * Deterministic "how to play this shape" reads (doc 19 §3 / doc 21).
 * Thin wrapper — full briefing lives in tactic-brief.ts.
 */

import type { AnalysisContext } from "./context.js";
import type { LinkBoard } from "./links.js";
import { buildTacticBrief, type StyleRead } from "./tactic-brief.js";

export type { StyleRead };

/** Prefer buildTacticBrief; kept for VerdictBar / tests. */
export function buildStyleReads(ctx: AnalysisContext, linkBoard: LinkBoard): readonly StyleRead[] {
  return buildTacticBrief(ctx, linkBoard).styleReads;
}
