/**
 * Per-slot succession horizon (docs/13-sporting-director.md §6): what rots and when.
 */

import type { AnalysisContext } from "../context.js";
import { T } from "../thresholds.js";
import { physicalReliance, projectFit } from "./ageing.js";
import { buildChain } from "./chains.js";
import type { SuccessionEntry } from "./types.js";

function horizonOf(fitIn1: number, fitIn2: number): number {
  if (fitIn1 < T.WEAK_FIT) return 1;
  if (fitIn2 < T.WEAK_FIT) return 2;
  return 3;
}

export function buildSuccession(ctx: AnalysisContext): SuccessionEntry[] {
  return ctx.slots.map((s): SuccessionEntry => {
    const starterId = s.starter?.id ?? null;
    const row = starterId ? (ctx.byId.get(starterId) ?? null) : null;
    const fitNow = s.starter?.fit ?? 0;
    const age = row?.player.age ?? null;
    const reliance = row ? physicalReliance(row.player) : 0.5;
    const fitIn1 = row ? projectFit(fitNow, age, reliance, 1) : 0;
    const fitIn2 = row ? projectFit(fitNow, age, reliance, 2) : 0;
    const fitIn3 = row ? projectFit(fitNow, age, reliance, 3) : 0;
    const heir = starterId ? buildChain(ctx, starterId) : null;
    const heirReady = heir != null && heir.source !== "none" && heir.ready;
    const horizon = horizonOf(fitIn1, fitIn2);

    const status: SuccessionEntry["status"] =
      horizon <= 1 && !heirReady
        ? "crisis"
        : horizon <= 2 || ((age ?? 0) >= T.AGE_PEAK_END && !heirReady)
          ? "watch"
          : "secure";

    return {
      slotKey: s.slotKey,
      slotLabel: s.label,
      starterId,
      starterAge: age,
      fitNow,
      fitIn1,
      fitIn2,
      fitIn3,
      heir,
      horizon,
      status,
    };
  });
}
