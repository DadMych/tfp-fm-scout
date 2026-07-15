/**
 * Shared helpers for rule modules — building the "scout for this" action and reading raw
 * attribute/derived values off a PlayerRow.
 */

import { midOf } from "../../attr-value.js";
import type { AttributeId } from "../../attributes.js";
import { DERIVED_INPUTS, type DerivedId } from "../../derived.js";
import { slotToGroups, type PositionSlot } from "../../positions.js";
import type { AnalysisContext } from "../context.js";
import type { SlotAssignment } from "../slots.js";
import { T } from "../thresholds.js";
import type { RawInsight, ScoutFilters } from "../types.js";
import type { PlayerRow } from "../xi.js";

export function isDerivedMetric(metric: string): metric is DerivedId {
  return metric in DERIVED_INPUTS;
}

/** Raw midpoint for an attribute, or a derived metric's value, whichever the id names. */
export function raw(row: PlayerRow, metric: string): number | null {
  return isDerivedMetric(metric) ? row.scores.derived[metric] : midOf(row.player.attrs, metric as AttributeId);
}

export function scoutAction(
  slot: PositionSlot,
  opts: { minFit?: number; maxAge?: number; maxValue?: number } = {},
): { kind: "scout"; filters: ScoutFilters } {
  const group = slotToGroups(slot)[0];
  return {
    kind: "scout",
    filters: {
      ...(group != null ? { group } : {}),
      ...(opts.maxAge != null ? { maxAge: opts.maxAge } : {}),
      ...(opts.maxValue != null ? { maxValue: opts.maxValue } : {}),
      ...(opts.minFit != null ? { minFitAtSlot: { slot, fit: opts.minFit } } : {}),
    },
  };
}

/** Deterministic insight id: `{ruleId}:{subject}` — subject makes it unique per finding. */
export function insightId(ruleId: string, subject: string): string {
  return `${ruleId}:${subject}`;
}

export function mk(insight: RawInsight): RawInsight {
  return insight;
}

/**
 * The starter blocking a young bench player, if any (docs/11 §4 AGE-4, reused by the
 * sporting-director loan-out verdict in doc 13 §4.2-2). A "block" is a shared slot with an
 * incumbent who is both elite (`T.ELITE_FIT`+) and not near the end of his career (≤27) —
 * i.e. not leaving any time soon.
 */
export function blockedBy(ctx: AnalysisContext, bench: PlayerRow): SlotAssignment | null {
  return (
    ctx.slots.find(
      (s) =>
        s.starter &&
        s.starter.fit >= T.ELITE_FIT &&
        (s.starterAge ?? 99) <= 27 &&
        bench.player.positions.includes(s.slot.slot),
    ) ?? null
  );
}
